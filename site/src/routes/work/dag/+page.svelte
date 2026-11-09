<script lang="ts">
	import { onMount } from 'svelte';
	import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { getFunctions, httpsCallable } from 'firebase/functions';
	import { clearCalendarToken, authState } from '$lib/auth.svelte';
	import { dayHeading, copenhagenToday, loadPrivateEvents, mergeProgram, whenLabel, type ProgramEvent } from '$lib/day';
	import { getDb, getFirebaseApp } from '$lib/firebase/client';
	import { workData, type Note } from '$lib/work.svelte';

	const day = copenhagenToday();
	let work = $state<ProgramEvent[]>([]);
	let personal = $state<ProgramEvent[]>([]);
	let privateReady = $state(false);
	let status = $state('');
	let draft = $state('');

	const events = $derived(mergeProgram([work, personal]));
	const tasks = $derived(
		workData.notes
			.filter((note) => note.kind === 'task' && note.day === day)
			.sort((a, b) => Number(a.done) - Number(b.done) || (a.title || '').localeCompare(b.title || '', 'da'))
	);

	onMount(() => {
		void loadWork();
		void loadPrivate(false);
	});

	async function loadWork() {
		try {
			const call = httpsCallable(getFunctions(getFirebaseApp(), 'europe-west1'), 'dayProgram');
			const result = await call({ day });
			const data = result.data as { events?: ProgramEvent[] };
			work = data.events ?? [];
		} catch (error) {
			console.error(error);
			status = 'Arbejdskalenderen svarede ikke.';
		}
	}

	async function loadPrivate(interactive: boolean) {
		let token = await authState.ensureCalendar(interactive);
		if (!token) {
			privateReady = false;
			return;
		}
		try {
			await readPrivate(token);
		} catch (error) {
			clearCalendarToken();
			if (!interactive || !(error instanceof Error) || error.name !== 'CalendarAuth') {
				console.error(error);
				personal = [];
				privateReady = false;
				if (interactive) status = 'Privat kalender svarede ikke.';
				return;
			}
			token = await authState.ensureCalendar(true);
			if (!token) {
				privateReady = false;
				return;
			}
			try {
				await readPrivate(token);
			} catch (retry) {
				console.error(retry);
				clearCalendarToken();
				personal = [];
				privateReady = false;
				status = 'Privat kalender svarede ikke.';
			}
		}
	}

	async function readPrivate(token: string) {
		personal = await loadPrivateEvents(token, day);
		privateReady = true;
		if (status === 'Privat kalender svarede ikke.') status = '';
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

	async function toggle(task: Note) {
		await updateDoc(doc(getDb(), 'here_private_notes', task.id), {
			done: !task.done,
			updatedAt: serverTimestamp()
		});
	}
</script>

<svelte:head><title>{dayHeading(day)}</title></svelte:head>

<h2>{dayHeading(day)}</h2>
{#if status}<p class="status">{status}</p>{/if}
<ul class="day">
	{#each events as event}
		<li>
			<span class="when">{whenLabel(event)}</span>
			<span class="what">
				<span>{event.title}</span>
				{#if event.location}<span class="where">{event.location}</span>{/if}
			</span>
			<span class="meta">{event.source === 'work' ? 'Arbejde' : 'Privat'}</span>
		</li>
	{/each}
</ul>
{#if !privateReady}
	<button type="button" class="secondary" onclick={() => loadPrivate(true)} disabled={authState.busy}>Privat kalender</button>
{/if}

<h2>Opgaver</h2>
<ul class="tasks">
	{#each tasks as task (task.id)}
		<li class:done={task.done}>
			<label>
				<input type="checkbox" checked={task.done} onchange={() => toggle(task)} />
				<span>{task.title}</span>
			</label>
		</li>
	{/each}
</ul>
<form class="task-add" onsubmit={addTask}>
	<input bind:value={draft} aria-label="Ny opgave" placeholder="Ny opgave" />
	<button type="submit">Tilføj</button>
</form>
