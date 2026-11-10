<script lang="ts">
	import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
	import { getFunctions, httpsCallable } from 'firebase/functions';
	import { clearGoogleToken, authState } from '$lib/auth.svelte';
	import { dayHeading, copenhagenToday, entryDocId, loadPrivateEvents, mergeProgram, whenLabel, type ProgramEvent } from '$lib/day';
	import EntryAgenda from '$lib/entry/EntryAgenda.svelte';
	import EntryNotes from '$lib/entry/EntryNotes.svelte';
	import EntryPhotos from '$lib/entry/EntryPhotos.svelte';
	import EntryPlace from '$lib/entry/EntryPlace.svelte';
	import { agendaStatus, entryStub, notesStatus, openPhotoPicker, photoStatus, placeStatus, scaleJpeg, type EntryDoc } from '$lib/entry';
	import { getDb, getFirebaseApp } from '$lib/firebase/client';
	import { workData, type Note } from '$lib/work.svelte';

	type Section = 'place' | 'agenda' | 'photos' | 'notes';

	let day = $state(copenhagenToday());
	let work = $state<ProgramEvent[]>([]);
	let personal = $state<ProgramEvent[]>([]);
	let privateReady = $state(false);
	let status = $state('');
	let draft = $state('');
	let keys = $state<Record<string, string>>({});
	let openKey = $state('');
	let section = $state<Section>('place');
	let showPanel = $state(false);
	let active = $state<ProgramEvent | null>(null);
	let busy = $state(false);
	let working = $state('');
	let panelError = $state('');
	const mailStarted = new Set<string>();

	const events = $derived(mergeProgram([work, personal]));
	const tasks = $derived(
		workData.notes
			.filter((note) => note.kind === 'task' && note.day === day)
			.sort((a, b) => Number(a.done) - Number(b.done) || (a.title || '').localeCompare(b.title || '', 'da'))
	);
	const entry = $derived((workData.notes.find((note) => note.id === openKey) as EntryDoc | undefined) ?? null);

	$effect(() => {
		const list = events;
		let cancel = false;
		void Promise.all(list.map(async (event) => [identity(event), await entryDocId(day, event)] as const)).then((pairs) => {
			if (!cancel) keys = Object.fromEntries(pairs);
		});
		return () => {
			cancel = true;
		};
	});

	$effect(() => {
		const current = day;
		void loadWork(current);
		void loadPrivate(false, current);
	});

	function shiftDay(by: number) {
		const [year, month, date] = day.split('-').map(Number);
		const value = new Date(Date.UTC(year, month - 1, date));
		value.setUTCDate(value.getUTCDate() + by);
		day = value.toISOString().slice(0, 10);
		openKey = '';
		active = null;
		showPanel = false;
		panelError = '';
		working = '';
	}

	function identity(event: ProgramEvent) {
		return [event.uid || '', event.source, event.start, event.title].join('\n');
	}

	function found(event: ProgramEvent) {
		const id = keys[identity(event)];
		return (workData.notes.find((note) => note.id === id) as EntryDoc | undefined) ?? null;
	}

	async function loadWork(current = day) {
		try {
			const call = httpsCallable(getFunctions(getFirebaseApp(), 'europe-west1'), 'dayProgram');
			const result = await call({ day: current });
			if (current !== day) return;
			const data = result.data as { events?: ProgramEvent[] };
			work = data.events ?? [];
		} catch (error) {
			console.error(error);
			status = 'Arbejdskalenderen svarede ikke.';
		}
	}

	async function loadPrivate(interactive: boolean, current = day) {
		let token = await authState.ensureGoogle(interactive);
		if (!token) {
			privateReady = false;
			return;
		}
		try {
			await readPrivate(token, current);
		} catch (error) {
			clearGoogleToken();
			if (!interactive || !(error instanceof Error) || error.name !== 'CalendarAuth') {
				console.error(error);
				personal = [];
				privateReady = false;
				if (interactive) status = 'Privat kalender svarede ikke.';
				return;
			}
			token = await authState.ensureGoogle(true);
			if (!token) {
				privateReady = false;
				return;
			}
			try {
				await readPrivate(token, current);
			} catch (retry) {
				console.error(retry);
				clearGoogleToken();
				personal = [];
				privateReady = false;
				status = 'Privat kalender svarede ikke.';
			}
		}
	}

	async function readPrivate(token: string, current = day) {
		const events = await loadPrivateEvents(token, current);
		if (current !== day) return;
		personal = events;
		privateReady = true;
		if (status === 'Privat kalender svarede ikke.') status = '';
	}

	async function ensure(event: ProgramEvent) {
		const id = keys[identity(event)] || (await entryDocId(day, event));
		const ref = doc(getDb(), 'here_private_notes', id);
		const snap = await getDoc(ref);
		if (!snap.exists()) {
			await setDoc(ref, { ...entryStub(day, event, id), updatedAt: serverTimestamp() });
		}
		openKey = id;
		active = event;
		keys = { ...keys, [identity(event)]: id };
		return id;
	}

	async function toggle(event: ProgramEvent) {
		const id = keys[identity(event)] || (await entryDocId(day, event));
		if (openKey === id) {
			openKey = '';
			active = null;
			showPanel = false;
			return;
		}
		panelError = '';
		await ensure(event);
		showPanel = false;
		void fetchIfEmpty();
	}

	async function pick(event: ProgramEvent, next: Section) {
		panelError = '';
		section = next;
		showPanel = true;
		await ensure(event);
	}

	function fail(error: unknown) {
		const message = error instanceof Error ? error.message : '';
		panelError = message && message.length < 90 ? message : 'Det lykkedes ikke.';
	}

	async function googleToken(refresh = false) {
		if (refresh) clearGoogleToken();
		return authState.ensureGoogle(true);
	}

	async function callWithGoogle<T>(name: string, payload: Record<string, unknown>) {
		const functions = getFunctions(getFirebaseApp(), 'europe-west1');
		const call = httpsCallable(functions, name);
		let token = await googleToken();
		if (!token) return null;
		try {
			return (await call({ ...payload, googleToken: token })) as T;
		} catch (error) {
			if (!needsGoogle(error)) throw error;
			token = await googleToken(true);
			if (!token) return null;
			return (await call({ ...payload, googleToken: token })) as T;
		}
	}

	function needsGoogle(error: unknown) {
		return error instanceof Error && error.message.includes('Google-adgang mangler');
	}

	async function fetchMail() {
		if (!active || busy) return;
		busy = true;
		working = 'Henter…';
		panelError = '';
		mailStarted.add(openKey);
		try {
			await ensure(active);
			const result = await callWithGoogle('enrichEvent', { day, event: active });
			if (result == null) {
				mailStarted.delete(openKey);
				panelError = 'Google-adgang mangler.';
			}
		} catch (error) {
			console.error(error);
			mailStarted.delete(openKey);
			fail(error);
		} finally {
			busy = false;
			working = '';
		}
	}

	async function fetchIfEmpty() {
		if (!active || busy) return;
		if (found(active)?.agenda?.fileUrl) return;
		if (mailStarted.has(openKey)) return;
		section = 'agenda';
		showPanel = true;
		await fetchMail();
	}

	async function savePlace(place: { name: string; address: string }) {
		if (!openKey) return;
		const mapsUrl = place.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}` : '';
		await updateDoc(doc(getDb(), 'here_private_notes', openKey), {
			place: { ...place, mapsUrl },
			updatedAt: serverTimestamp()
		});
	}

	async function saveAgenda(text: string) {
		if (!openKey) return;
		await updateDoc(doc(getDb(), 'here_private_notes', openKey), {
			agenda: {
				text,
				fileUrl: text ? entry?.agenda?.fileUrl || '' : '',
				messageId: text ? entry?.agenda?.messageId || '' : '',
				from: text ? entry?.agenda?.from || '' : ''
			},
			updatedAt: serverTimestamp()
		});
	}

	async function saveNotes(notes: { raw: string; summary: string }) {
		if (!openKey) return;
		await updateDoc(doc(getDb(), 'here_private_notes', openKey), {
			notes: {
				raw: notes.raw,
				summary: notes.summary,
				questions: notes.raw || notes.summary ? entry?.notes?.questions || [] : [],
				people: notes.raw || notes.summary ? entry?.notes?.people || [] : [],
				sources: notes.raw || notes.summary ? entry?.notes?.sources || [] : []
			},
			updatedAt: serverTimestamp()
		});
	}

	async function addCamera(file: File) {
		if (!active) return;
		busy = true;
		working = 'Henter billeder…';
		panelError = '';
		try {
			const id = await ensure(active);
			const data = await scaleJpeg(file);
			const call = httpsCallable(getFunctions(getFirebaseApp(), 'europe-west1'), 'addPhotos');
			await call({ entryId: id, images: [{ data, takenAt: new Date().toISOString() }] });
		} catch (error) {
			console.error(error);
			fail(error);
		} finally {
			busy = false;
			working = '';
		}
	}

	async function pickPhotos() {
		if (!active) return;
		const popup = window.open('about:blank', '_blank');
		busy = true;
		working = 'Henter billeder…';
		panelError = '';
		try {
			const id = await ensure(active);
			let token = await googleToken();
			if (!token) {
				popup?.close();
				return;
			}
			let sessionId = '';
			try {
				sessionId = await openPhotoPicker(token, popup);
			} catch (error) {
				if (!needsGoogle(error)) throw error;
				token = await googleToken(true);
				if (!token) {
					popup?.close();
					return;
				}
				sessionId = await openPhotoPicker(token, popup);
			}
			await callWithGoogle('importPicked', { entryId: id, sessionId });
		} catch (error) {
			console.error(error);
			fail(error);
		} finally {
			busy = false;
			working = '';
		}
	}

	async function confirmPhoto(index: number) {
		if (!openKey || !entry?.photos) return;
		const photos = entry.photos.map((photo, item) => (item === index ? { ...photo, confirmed: true } : photo));
		await updateDoc(doc(getDb(), 'here_private_notes', openKey), { photos, updatedAt: serverTimestamp() });
	}

	async function removePhoto(index: number) {
		if (!openKey || !entry?.photos) return;
		const photos = entry.photos.filter((_, item) => item !== index);
		await updateDoc(doc(getDb(), 'here_private_notes', openKey), { photos, updatedAt: serverTimestamp() });
	}

	async function writeNotes() {
		if (!openKey) return;
		busy = true;
		working = 'Skriver…';
		panelError = '';
		try {
			const call = httpsCallable(getFunctions(getFirebaseApp(), 'europe-west1'), 'writeNotes');
			await call({ entryId: openKey });
		} catch (error) {
			console.error(error);
			fail(error);
		} finally {
			busy = false;
			working = '';
		}
	}

	function rowStatus(event: ProgramEvent, kind: Section, ready: string) {
		if (busy && keys[identity(event)] === openKey) {
			if (working === 'Henter…' && (kind === 'place' || kind === 'agenda')) return working;
			if (working === 'Skriver…' && kind === 'notes') return working;
			if (working === 'Henter billeder…' && kind === 'photos') return working;
		}
		return ready;
	}

	async function addTask(event: SubmitEvent) {
		event.preventDefault();
		const title = draft.trim();
		if (!title) return;
		draft = '';
		await addDoc(collection(getDb(), 'here_private_notes'), {
			kind: 'task',
			title,
			done: false,
			day,
			updatedAt: serverTimestamp()
		});
	}

	async function toggleTask(task: Note) {
		await updateDoc(doc(getDb(), 'here_private_notes', task.id), {
			done: !task.done,
			updatedAt: serverTimestamp()
		});
	}
</script>

<svelte:head><title>{dayHeading(day)}</title></svelte:head>

<div class="day-page">
<div class="day-board">
	<div>
		<div class="day-nav">
			<button type="button" class="tlink" onclick={() => shiftDay(-1)}>I går</button>
			<button type="button" class="tlink" onclick={() => shiftDay(1)}>I morgen</button>
		</div>
		<h2>{dayHeading(day)}</h2>
		{#if status}<p class="status">{status}</p>{/if}
		<ul class="day">
			{#each events as event (identity(event))}
				<li class:open={openKey === keys[identity(event)] && openKey !== ''}>
					<button type="button" class="event" onclick={() => toggle(event)}>
						<span class="when">{whenLabel(event)}</span>
						<span class="what">{event.title}</span>
						<span class="plus"></span>
					</button>
					{#if openKey === keys[identity(event)]}
						<div class="points">
							<button type="button" class:on={showPanel && section === 'place'} onclick={() => pick(event, 'place')}>
								<span>Sted og tid</span><span class:working={rowStatus(event, 'place', '') === 'Henter…'}>{rowStatus(event, 'place', placeStatus(found(event)))}</span>
							</button>
							<button type="button" class:on={showPanel && section === 'agenda'} onclick={() => pick(event, 'agenda')}>
								<span>Dagsorden</span><span class:working={rowStatus(event, 'agenda', '') === 'Henter…'}>{rowStatus(event, 'agenda', agendaStatus(found(event)))}</span>
							</button>
							<button type="button" class:on={showPanel && section === 'photos'} onclick={() => pick(event, 'photos')}>
								<span>Billeder</span><span class:working={rowStatus(event, 'photos', '') === 'Henter billeder…'}>{rowStatus(event, 'photos', photoStatus(found(event)))}</span>
							</button>
							<button type="button" class:on={showPanel && section === 'notes'} onclick={() => pick(event, 'notes')}>
								<span>Noter</span><span class:working={rowStatus(event, 'notes', '') === 'Skriver…'}>{rowStatus(event, 'notes', notesStatus(found(event)))}</span>
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		{#if !privateReady}
			<button type="button" class="tlink lead" onclick={() => loadPrivate(true)} disabled={authState.busy}>Privat kalender</button>
		{/if}

		<p class="section-label">Opgaver</p>
		<ul class="tasks">
			{#each tasks as task (task.id)}
				<li class:done={task.done}>
					<label>
						<input type="checkbox" checked={task.done} onchange={() => toggleTask(task)} />
						<span>{task.title}</span>
					</label>
				</li>
			{/each}
		</ul>
		<form class="task-add" onsubmit={addTask}>
			<input bind:value={draft} aria-label="Ny opgave" placeholder="Ny opgave" />
			<button type="submit" class="tlink">Tilføj</button>
		</form>
	</div>

	{#if showPanel && active}
		<aside class="entry-panel">
			{#if working || panelError}<p class="status">{working || panelError}</p>{/if}
			{#if section === 'place'}
				<EntryPlace {entry} when={whenLabel(active)} {busy} onFetch={fetchMail} onSave={savePlace} />
			{:else if section === 'agenda'}
				<EntryAgenda {entry} {busy} onFetch={fetchMail} onSave={saveAgenda} />
			{:else if section === 'photos'}
				<EntryPhotos {entry} when={whenLabel(active)} {busy} onCamera={addCamera} onPick={pickPhotos} onConfirm={confirmPhoto} onRemove={removePhoto} />
			{:else}
				<EntryNotes {entry} {busy} onWrite={writeNotes} onSave={saveNotes} />
			{/if}
		</aside>
	{/if}
</div>
</div>
