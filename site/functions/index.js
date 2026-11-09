const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { eventsOn } = require('./ics');

const workIcsUrl = defineSecret('HERE_WORK_ICS_URL');

function copenhagenToday() {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Copenhagen',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
}

exports.dayProgram = onCall({ region: 'europe-west1', secrets: [workIcsUrl], invoker: 'public' }, async (request) => {
	const email = request.auth?.token?.email;
	const verified = request.auth?.token?.email_verified;
	if (email !== 'simmoe@gmail.com' || verified !== true) {
		throw new HttpsError('permission-denied', 'Ingen adgang.');
	}
	const requested = request.data?.day;
	const day = typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : copenhagenToday();
	const response = await fetch(workIcsUrl.value());
	if (!response.ok) throw new HttpsError('unavailable', 'Arbejdskalenderen svarede ikke.');
	const text = await response.text();
	return { day, events: eventsOn(text, day) };
});
