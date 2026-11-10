const { createHash, randomUUID } = require('crypto');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) initializeApp();

const MODEL = 'gemini-2.5-flash';
const bucket = getStorage().bucket('p5-firebase-eebc1.appspot.com');
const db = getFirestore();

function entryDocId(day, event) {
	const raw = [day, event.uid || '', event.source || '', event.start || '', event.title || ''].join('\n');
	return `entry_${day}_${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}

function decode64(data) {
	return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function mapsUrl(address) {
	const query = String(address || '').trim();
	if (!query) return '';
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function saveObject(entryId, filename, buffer, contentType) {
	const safe = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 48) || 'file';
	const path = `here_private/entries/${entryId}/${randomUUID()}-${safe}`;
	const token = randomUUID();
	await bucket.file(path).save(buffer, {
		resumable: false,
		metadata: {
			contentType,
			metadata: { firebaseStorageDownloadTokens: token }
		}
	});
	const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
	return { path, url };
}

async function gemini(apiKey, parts) {
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ role: 'user', parts }],
				generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
			})
		}
	);
	if (!response.ok) {
		const detail = await response.text();
		console.error('gemini', response.status, detail.slice(0, 300));
		throw new Error('gemini');
	}
	const data = await response.json();
	const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end === -1) throw new Error('gemini');
	return JSON.parse(text.slice(start, end + 1));
}

async function gmail(token, path) {
	const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (response.status === 401 || response.status === 403) {
		const error = new Error('auth');
		error.code = response.status;
		throw error;
	}
	if (!response.ok) throw new Error('gmail');
	return response.json();
}

function mailQuery(event, day) {
	const [year, month, date] = day.split('-').map(Number);
	const after = new Date(Date.UTC(year, month - 1, date - 50));
	const before = new Date(Date.UTC(year, month - 1, date + 2));
	const stamp = (value) => value.toISOString().slice(0, 10).replaceAll('-', '/');
	const words = String(event.title || '')
		.replace(/[^\p{L}\p{N} -]/gu, ' ')
		.split(/\s+/)
		.filter((word) => word.length >= 2)
		.slice(0, 6);
	const term = words.map((word) => `"${word}"`).join(' OR ');
	return `after:${stamp(after)} before:${stamp(before)} (${term || 'møde'})`;
}

function walkParts(part, acc) {
	if (!part) return;
	if (part.mimeType === 'text/plain' && part.body?.data) acc.text.push(decode64(part.body.data).toString('utf8'));
	if (part.mimeType === 'application/pdf' && part.body?.attachmentId) {
		acc.pdfs.push({
			filename: part.filename || 'dagsorden.pdf',
			attachmentId: part.body.attachmentId,
			size: part.body.size || 0
		});
	}
	for (const child of part.parts || []) walkParts(child, acc);
}

function header(message, name) {
	const found = (message.payload?.headers || []).find((item) => item.name.toLowerCase() === name);
	return found?.value || '';
}

async function collectMail(token, day, event) {
	const base = mailQuery(event, day);
	const ids = [];
	for (const query of [`${base} filename:pdf`, base]) {
		const listed = await gmail(token, `/messages?q=${encodeURIComponent(query)}&maxResults=8`);
		for (const item of listed.messages || []) {
			if (!ids.includes(item.id)) ids.push(item.id);
		}
	}
	const messages = [];
	for (const id of ids.slice(0, 8)) {
		const message = await gmail(token, `/messages/${id}?format=full`);
		const parts = { text: [], pdfs: [] };
		walkParts(message.payload, parts);
		const text = parts.text.join('\n').replace(/\s+\n/g, '\n').trim().slice(0, 6000);
		messages.push({
			id: message.id,
			from: header(message, 'from').slice(0, 200),
			subject: header(message, 'subject').slice(0, 200),
			date: header(message, 'date').slice(0, 80),
			text,
			pdfs: parts.pdfs.filter((file) => file.size < 8_000_000).slice(0, 2)
		});
	}
	return messages;
}

function pickPdf(messages) {
	const files = messages.flatMap((message) => message.pdfs.map((file) => ({ ...file, message })));
	return (
		files.find((file) => /dagsorden|agenda/i.test(file.filename)) ||
		files.sort((a, b) => b.size - a.size)[0] ||
		null
	);
}

async function readContext(apiKey, token, messages, event) {
	const chosen = pickPdf(messages);
	let pdf = null;
	if (chosen) {
		const attachment = await gmail(
			token,
			`/messages/${chosen.message.id}/attachments/${chosen.attachmentId}`
		);
		pdf = { filename: chosen.filename, message: chosen.message, bytes: decode64(attachment.data || '') };
	}
	const mail = messages
		.map((message, index) => `Mail ${index}\nFra: ${message.from}\nEmne: ${message.subject}\nDato: ${message.date}\n${message.text}`)
		.join('\n\n')
		.slice(0, 14000);
	const parts = [
		{
			text: [
				'Du læser en kalenderbegivenhed og de mails, der kan høre til den.',
				'Brug kun det, der står i mailen eller i PDF-filen. Opfind ikke en adresse.',
				'Svar som JSON: {"place":{"name":"","address":""},"agenda":"","messageIndex":0}',
				'place.name er stedets navn. place.address er gaden, postnummer og by, hvis mailen nævner det.',
				'agenda er dagsordenens egen tekst fra PDF-filen, hvis der er en. En senere kort mail må rette tid og sted, men ikke erstatte dagsordenen. Tom streng, hvis der ingen dagsorden er.',
				'messageIndex er nummeret på den mail, dagsordenen kommer fra.',
				'',
				`Begivenhed: ${event.title}`,
				`Tid: ${event.start || ''}${event.end ? '–' + event.end : ''}`,
				`Sted i kalenderen: ${event.location || ''}`,
				`Kalendertekst: ${String(event.description || '').slice(0, 1000)}`,
				'',
				mail
			].join('\n')
		}
	];
	if (pdf?.bytes?.length) {
		parts.push({ inlineData: { mimeType: 'application/pdf', data: pdf.bytes.toString('base64') } });
	}
	const parsed = await gemini(apiKey, parts);
	const index = Number(parsed.messageIndex);
	const message = pdf?.message || messages[index] || messages[0];
	return { parsed, pdf, message };
}

function asPeople(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => ({ name: String(item?.name || '').slice(0, 120), role: String(item?.role || '').slice(0, 160) }))
		.filter((item) => item.name)
		.slice(0, 30);
}

function asSources(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => ({ title: String(item?.title || '').slice(0, 160), detail: String(item?.detail || '').slice(0, 400) }))
		.filter((item) => item.title || item.detail)
		.slice(0, 30);
}

function asQuestions(value) {
	if (!Array.isArray(value)) return [];
	return value.map((item) => String(item).slice(0, 300)).filter(Boolean).slice(0, 30);
}

async function loadEntry(entryId) {
	const snap = await db.collection('here_private_notes').doc(entryId).get();
	return snap.exists ? snap.data() : null;
}

async function mergeEntry(entryId, fields) {
	await db.collection('here_private_notes').doc(entryId).set(
		{ ...fields, updatedAt: FieldValue.serverTimestamp() },
		{ merge: true }
	);
}

async function appendPhotos(entryId, added) {
	const ref = db.collection('here_private_notes').doc(entryId);
	await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		const photos = snap.exists ? snap.get('photos') || [] : [];
		tx.set(ref, { kind: 'entry', photos: photos.concat(added), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
	});
}

module.exports = {
	MODEL,
	entryDocId,
	mapsUrl,
	saveObject,
	gemini,
	collectMail,
	readContext,
	asPeople,
	asSources,
	asQuestions,
	loadEntry,
	mergeEntry,
	appendPhotos,
	bucket
};
