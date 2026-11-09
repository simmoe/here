export type ProgramSource = 'work' | 'private';

export type ProgramEvent = {
	uid?: string;
	title: string;
	location: string;
	description?: string;
	start: string;
	end: string;
	allDay: boolean;
	source: ProgramSource;
};

/** Same string as site/functions/ai.js entryDocId. */
export async function entryDocId(day: string, event: ProgramEvent) {
	const raw = [day, event.uid || '', event.source, event.start, event.title].join('\n');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
	const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
	return `entry_${day}_${hex}`;
}

export function copenhagenToday(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Copenhagen',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

export function dayHeading(day: string) {
	const [year, month, date] = day.split('-').map(Number);
	return new Intl.DateTimeFormat('da-DK', {
		timeZone: 'Europe/Copenhagen',
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	}).format(new Date(Date.UTC(year, month - 1, date, 12)));
}

export function nextDay(day: string) {
	const [year, month, date] = day.split('-').map(Number);
	const value = new Date(Date.UTC(year, month - 1, date));
	value.setUTCDate(value.getUTCDate() + 1);
	return value.toISOString().slice(0, 10);
}

export function copenhagenOffset(day: string) {
	const probe = new Date(`${day}T12:00:00Z`);
	const name = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Europe/Copenhagen',
		timeZoneName: 'shortOffset'
	})
		.formatToParts(probe)
		.find((part) => part.type === 'timeZoneName')?.value;
	const match = name?.match(/([+-])(\d{1,2})(?::?(\d{2}))?/);
	if (!match) return '+01:00';
	return `${match[1]}${match[2].padStart(2, '0')}:${match[3] ?? '00'}`;
}

export function clock(iso: string) {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Copenhagen',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(new Date(iso));
	const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
	const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
	return `${hour}:${minute}`;
}

export function whenLabel(event: ProgramEvent) {
	if (event.allDay) return 'Hele dagen';
	if (event.start && event.end) return `${event.start}–${event.end}`;
	return event.start;
}

export function mergeProgram(groups: ProgramEvent[][]) {
	return groups.flat().sort((a, b) => {
		if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
		return a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'da');
	});
}

type GoogleEvent = {
	id?: string;
	summary?: string;
	description?: string;
	location?: string;
	status?: string;
	start?: { date?: string; dateTime?: string };
	end?: { date?: string; dateTime?: string };
	attendees?: { self?: boolean; responseStatus?: string }[];
};

export async function loadPrivateEvents(token: string, day: string) {
	const offset = copenhagenOffset(day);
	const params = new URLSearchParams({
		timeMin: `${day}T00:00:00${offset}`,
		timeMax: `${nextDay(day)}T00:00:00${offset}`,
		singleEvents: 'true',
		orderBy: 'startTime',
		maxResults: '50'
	});
	const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (response.status === 401 || response.status === 403) {
		const error = new Error('unauthorized');
		error.name = 'CalendarAuth';
		throw error;
	}
	if (!response.ok) throw new Error('Privat kalender svarede ikke');
	const data = (await response.json()) as { items?: GoogleEvent[] };
	return (data.items ?? []).flatMap((item) => {
		if (item.status === 'cancelled') return [];
		if (item.attendees?.some((person) => person.self && person.responseStatus === 'declined')) return [];
		const title = item.summary?.trim();
		if (!title) return [];
		const allDay = Boolean(item.start?.date && !item.start?.dateTime);
		return [
			{
				uid: item.id || '',
				title,
				location: item.location?.trim() ?? '',
				description: item.description?.trim().slice(0, 2000) ?? '',
				start: allDay || !item.start?.dateTime ? '' : clock(item.start.dateTime),
				end: allDay || !item.end?.dateTime ? '' : clock(item.end.dateTime),
				allDay,
				source: 'private' as const
			}
		];
	});
}
