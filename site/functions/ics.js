function unfold(text) {
	return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeText(value) {
	return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function prop(block, name) {
	const match = block.match(new RegExp(`^${name}([^:\\n]*):(.*)$`, 'm'));
	if (!match) return null;
	return { params: match[1], value: match[2].trim() };
}

function when(property) {
	if (!property) return null;
	const match = property.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
	if (!match) return null;
	return {
		day: `${match[1]}-${match[2]}-${match[3]}`,
		time: match[4] ? `${match[4]}:${match[5]}` : '',
		allDay: property.params.includes('VALUE=DATE') || !match[4]
	};
}

function onDay(start, end, day) {
	if (!start) return false;
	if (start.allDay) {
		if (!end || end.day === start.day) return start.day === day;
		return start.day <= day && day < end.day;
	}
	if (start.day === day) return true;
	if (!end || start.day > day || end.day < day) return false;
	if (end.day === day && end.time === '00:00') return false;
	return true;
}

function eventsOn(text, day) {
	const events = [];
	for (const block of unfold(text).split('BEGIN:VEVENT').slice(1)) {
		const body = block.split('END:VEVENT')[0];
		const status = prop(body, 'STATUS')?.value;
		if (status === 'CANCELLED') continue;
		const start = when(prop(body, 'DTSTART'));
		const end = when(prop(body, 'DTEND'));
		if (!onDay(start, end, day)) continue;
		const title = unescapeText(prop(body, 'SUMMARY')?.value || '').trim();
		if (!title) continue;
		events.push({
			uid: prop(body, 'UID')?.value || '',
			title,
			location: unescapeText(prop(body, 'LOCATION')?.value || '').trim(),
			description: unescapeText(prop(body, 'DESCRIPTION')?.value || '').trim().slice(0, 2000),
			start: start.allDay ? '' : start.time,
			end: end && !end.allDay ? end.time : '',
			allDay: start.allDay,
			source: 'work'
		});
	}
	events.sort((a, b) => {
		if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
		return a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'da');
	});
	return events;
}

module.exports = { eventsOn };
