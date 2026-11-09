const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { eventsOn } = require('./ics');
const ai = require('./ai');

const workIcsUrl = defineSecret('HERE_WORK_ICS_URL');
const geminiKey = defineSecret('HERE_GEMINI_API_KEY');

function copenhagenToday() {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Copenhagen',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
}

function assertOwner(request) {
	const email = request.auth?.token?.email;
	const verified = request.auth?.token?.email_verified;
	if (email !== 'simmoe@gmail.com' || verified !== true) {
		throw new HttpsError('permission-denied', 'Ingen adgang.');
	}
}

function googleFailure(error) {
	if (error?.code === 401 || error?.code === 403 || error?.message === 'auth') {
		throw new HttpsError('failed-precondition', 'Google-adgang mangler.');
	}
	console.error(error);
	throw new HttpsError('unavailable', 'Det lykkedes ikke.');
}

const call = {
	region: 'europe-west1',
	invoker: 'public',
	timeoutSeconds: 120,
	memory: '1GiB'
};

exports.dayProgram = onCall({ region: 'europe-west1', secrets: [workIcsUrl], invoker: 'public' }, async (request) => {
	assertOwner(request);
	const requested = request.data?.day;
	const day = typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : copenhagenToday();
	const response = await fetch(workIcsUrl.value());
	if (!response.ok) throw new HttpsError('unavailable', 'Arbejdskalenderen svarede ikke.');
	const text = await response.text();
	return { day, events: eventsOn(text, day) };
});

exports.enrichEvent = onCall({ ...call, secrets: [geminiKey] }, async (request) => {
	assertOwner(request);
	const day = request.data?.day;
	const event = request.data?.event;
	const googleToken = request.data?.googleToken;
	if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !event?.title || typeof googleToken !== 'string') {
		throw new HttpsError('invalid-argument', 'Mangler oplysninger.');
	}
	const entryId = ai.entryDocId(day, event);
	try {
		const messages = await ai.collectMail(googleToken, day, event);
		const { parsed, pdf, message } = await ai.readContext(geminiKey.value(), googleToken, messages, event);
		const address = String(parsed?.place?.address || '').trim();
		const name = String(parsed?.place?.name || '').trim();
		let fileUrl = '';
		if (pdf?.bytes?.length) {
			const saved = await ai.saveObject(entryId, pdf.filename, pdf.bytes, 'application/pdf');
			fileUrl = saved.url;
		}
		const context = messages
			.map((item) => `${item.from} — ${item.subject}\n${item.text}`)
			.join('\n\n')
			.slice(0, 12000);
		await ai.mergeEntry(entryId, {
			kind: 'entry',
			day,
			eventKey: entryId.slice(-16),
			source: event.source === 'private' ? 'private' : 'work',
			title: String(event.title).slice(0, 200),
			start: String(event.start || ''),
			end: String(event.end || ''),
			place: { name, address, mapsUrl: ai.mapsUrl(address) },
			agenda: {
				text: String(parsed?.agenda || '').slice(0, 20000),
				fileUrl,
				messageId: message?.id || '',
				from: message?.from || ''
			},
			context
		});
		return { id: entryId };
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		googleFailure(error);
	}
});

exports.addPhotos = onCall({ ...call, memory: '512MiB' }, async (request) => {
	assertOwner(request);
	const entryId = request.data?.entryId;
	const images = request.data?.images;
	if (!validEntryId(entryId) || !Array.isArray(images) || images.length === 0 || images.length > 4) {
		throw new HttpsError('invalid-argument', 'Mangler oplysninger.');
	}
	const added = [];
	for (const image of images) {
		const buffer = Buffer.from(String(image?.data || ''), 'base64');
		if (!buffer.length || buffer.length > 1_200_000) throw new HttpsError('invalid-argument', 'Billedet er for stort.');
		const saved = await ai.saveObject(entryId, 'photo.jpg', buffer, 'image/jpeg');
		added.push({
			path: saved.path,
			url: saved.url,
			takenAt: String(image.takenAt || new Date().toISOString()).slice(0, 40),
			confirmed: false
		});
	}
	await ai.appendPhotos(entryId, added);
	return { added: added.length };
});

exports.importPicked = onCall(call, async (request) => {
	assertOwner(request);
	const entryId = request.data?.entryId;
	const sessionId = request.data?.sessionId;
	const googleToken = request.data?.googleToken;
	if (!validEntryId(entryId) || typeof sessionId !== 'string' || typeof googleToken !== 'string') {
		throw new HttpsError('invalid-argument', 'Mangler oplysninger.');
	}
	try {
		const added = [];
		let pageToken = '';
		do {
			const url = new URL('https://photospicker.googleapis.com/v1/mediaItems');
			url.searchParams.set('sessionId', sessionId);
			if (pageToken) url.searchParams.set('pageToken', pageToken);
			const response = await fetch(url, { headers: { Authorization: `Bearer ${googleToken}` } });
			if (response.status === 401 || response.status === 403) {
				throw Object.assign(new Error('auth'), { code: response.status });
			}
			if (!response.ok) throw new Error('picker');
			const data = await response.json();
			for (const item of data.mediaItems || []) {
				if (added.length >= 8) break;
				const file = item.mediaFile;
				if (!file?.baseUrl || !String(file.mimeType || '').startsWith('image/')) continue;
				const download = file.baseUrl.includes('=') ? file.baseUrl : `${file.baseUrl}=w2000`;
				const image = await fetch(download, { headers: { Authorization: `Bearer ${googleToken}` } });
				if (!image.ok) continue;
				const buffer = Buffer.from(await image.arrayBuffer());
				if (!buffer.length || buffer.length > 4_000_000) continue;
				const saved = await ai.saveObject(entryId, 'photo.jpg', buffer, 'image/jpeg');
				added.push({
					path: saved.path,
					url: saved.url,
					takenAt: String(item.createTime || ''),
					confirmed: false
				});
			}
			pageToken = data.nextPageToken || '';
		} while (pageToken && added.length < 8);
		await ai.appendPhotos(entryId, added);
		return { added: added.length };
	} catch (error) {
		if (error instanceof HttpsError) throw error;
		googleFailure(error);
	}
});

exports.writeNotes = onCall({ ...call, secrets: [geminiKey] }, async (request) => {
	assertOwner(request);
	const entryId = request.data?.entryId;
	if (!validEntryId(entryId)) throw new HttpsError('invalid-argument', 'Mangler oplysninger.');
	const entry = await ai.loadEntry(entryId);
	if (!entry) throw new HttpsError('not-found', 'Noten findes ikke.');
	const photos = (entry.photos || []).filter((photo) => photo.confirmed && photo.path);
	if (!photos.length) throw new HttpsError('failed-precondition', 'Bekræft et billede først.');
	const parts = [
		{
			text: [
				'Du læser bekræftede billeder af noter fra et møde, sammen med dagsorden og mailuddrag.',
				'raw er en tro gengivelse af teksten på billederne.',
				'summary er et færdigt dansk resumé, der bruger noter, dagsorden og mail. Opfind ikke indhold.',
				'questions er spørgsmål, teksten stiller. people er personer, der faktisk nævnes. sources er kilder, teksten henviser til.',
				'Svar som JSON: {"raw":"","summary":"","questions":[],"people":[{"name":"","role":""}],"sources":[{"title":"","detail":""}]}',
				'',
				`Begivenhed: ${entry.title || ''}`,
				`Tid: ${entry.start || ''}${entry.end ? '–' + entry.end : ''}`,
				`Sted: ${entry.place?.name || ''} ${entry.place?.address || ''}`,
				`Dagsorden:\n${String(entry.agenda?.text || '').slice(0, 8000)}`,
				`Mail:\n${String(entry.context || '').slice(0, 6000)}`
			].join('\n')
		}
	];
	for (const photo of photos.slice(0, 6)) {
		const [bytes] = await ai.bucket.file(photo.path).download();
		parts.push({ inlineData: { mimeType: 'image/jpeg', data: bytes.toString('base64') } });
	}
	try {
		const parsed = await ai.gemini(geminiKey.value(), parts);
		await ai.mergeEntry(entryId, {
			notes: {
				raw: String(parsed.raw || '').slice(0, 20000),
				summary: String(parsed.summary || '').slice(0, 20000),
				questions: ai.asQuestions(parsed.questions),
				people: ai.asPeople(parsed.people),
				sources: ai.asSources(parsed.sources)
			}
		});
		return { ok: true };
	} catch (error) {
		console.error(error);
		throw new HttpsError('unavailable', 'Noterne blev ikke skrevet.');
	}
});

function validEntryId(value) {
	return typeof value === 'string' && /^entry_\d{4}-\d{2}-\d{2}_[a-f0-9]{16}$/.test(value);
}
