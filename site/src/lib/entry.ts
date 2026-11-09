import type { ProgramEvent, ProgramSource } from './day';

export type EntryPhoto = {
	path: string;
	url: string;
	takenAt: string;
	confirmed: boolean;
};

export type EntryDoc = {
	id: string;
	kind: 'entry';
	day: string;
	eventKey: string;
	source: ProgramSource;
	title: string;
	start: string;
	end: string;
	place?: { name?: string; address?: string; mapsUrl?: string };
	agenda?: { text?: string; fileUrl?: string; messageId?: string; from?: string };
	photos?: EntryPhoto[];
	notes?: {
		raw?: string;
		summary?: string;
		questions?: string[];
		people?: { name?: string; role?: string }[];
		sources?: { title?: string; detail?: string }[];
	};
};

export function entryStub(day: string, event: ProgramEvent, id: string) {
	return {
		kind: 'entry' as const,
		day,
		eventKey: id.slice(-16),
		source: event.source,
		title: event.title,
		start: event.start,
		end: event.end,
		place: { name: '', address: '', mapsUrl: '' },
		agenda: { text: '', fileUrl: '', messageId: '', from: '' },
		photos: [],
		notes: { raw: '', summary: '', questions: [], people: [], sources: [] }
	};
}

export function placeStatus(entry: EntryDoc | null) {
	return entry?.place?.address || entry?.place?.name || '';
}

export function agendaStatus(entry: EntryDoc | null) {
	const text = entry?.agenda?.text?.trim();
	if (!text) return '';
	return text.split('\n').find((line) => line.trim())?.trim().slice(0, 48) || '';
}

export function photoStatus(entry: EntryDoc | null) {
	const photos = entry?.photos || [];
	if (!photos.length) return '';
	const confirmed = photos.filter((photo) => photo.confirmed).length;
	return confirmed ? `${confirmed} bekræftet` : String(photos.length);
}

export function notesStatus(entry: EntryDoc | null) {
	if (entry?.notes?.summary?.trim()) return 'Resumé';
	if (entry?.notes?.raw?.trim()) return 'Tekst';
	return '';
}

export function scaleJpeg(file: File) {
	return new Promise<string>((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(image.width * scale);
			canvas.height = Math.round(image.height * scale);
			const context = canvas.getContext('2d');
			if (!context) {
				URL.revokeObjectURL(url);
				reject(new Error('canvas'));
				return;
			}
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
			const data = canvas.toDataURL('image/jpeg', 0.82).split(',')[1] || '';
			URL.revokeObjectURL(url);
			resolve(data);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('image'));
		};
		image.src = url;
	});
}

export async function openPhotoPicker(token: string, popup: Window | null) {
	const created = await fetch('https://photospicker.googleapis.com/v1/sessions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: '{}'
	});
	if (!created.ok) {
		popup?.close();
		throw new Error(created.status === 401 || created.status === 403 ? 'Google-adgang mangler.' : 'Google Photos svarede ikke.');
	}
	const session = (await created.json()) as { id?: string; pickerUri?: string };
	if (!session.id || !session.pickerUri) {
		popup?.close();
		throw new Error('Google Photos svarede ikke.');
	}
	if (popup) popup.location.href = session.pickerUri;
	const started = Date.now();
	while (Date.now() - started < 3 * 60 * 1000) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const poll = await fetch(`https://photospicker.googleapis.com/v1/sessions/${session.id}`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (!poll.ok) continue;
		const body = (await poll.json()) as { mediaItemsSet?: boolean };
		if (body.mediaItemsSet) return session.id;
	}
	popup?.close();
	throw new Error('Google Photos svarede ikke.');
}
