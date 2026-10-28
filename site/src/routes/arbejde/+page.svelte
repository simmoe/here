<script lang="ts">
	import {
		addDoc,
		collection,
		deleteDoc,
		doc,
		onSnapshot,
		serverTimestamp,
		updateDoc,
		type Unsubscribe
	} from 'firebase/firestore';
	import '../../../../arbejde.css';
	import { authState } from '$lib/auth.svelte';
	import { getDb } from '$lib/firebase/client';

	type Field = { key: string; label: string; kind: string };
	type ClassItem = { id: string; title: string; order?: number; year?: string; subject?: string; level?: string; fields?: Field[] };
	type Student = { id: string; name: string; birthDate?: string };
	type Enrollment = { id: string; classId: string; studentId: string; studyLine?: string; groups?: string[]; values?: Record<string, string> };
	type Group = {
		id: string;
		classId: string;
		projectName: string;
		studentIds: string[];
		boardUrl?: string;
		fields?: Field[];
		values?: Record<string, string>;
	};
	type Note = { id: string; title?: string; body?: string; updatedAt?: { seconds?: number } };

	let classes = $state<ClassItem[]>([]);
	let students = $state<Student[]>([]);
	let enrollments = $state<Enrollment[]>([]);
	let groups = $state<Group[]>([]);
	let notes = $state<Note[]>([]);
	let selectedClassId = $state('');
	let status = $state('');
	let noteId = $state('');
	let noteTitle = $state('');
	let noteBody = $state('');
	let projectName = $state('');
	let boardUrl = $state('');
	let picked = $state<string[]>([]);
	let listening = false;

	const current = $derived(classes.find((item) => item.id === selectedClassId) || classes[0]);
	const classEnrollments = $derived(
		enrollments
			.filter((item) => item.classId === current?.id)
			.map((enrollment) => ({ enrollment, student: students.find((item) => item.id === enrollment.studentId) }))
			.sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || '', 'da'))
	);
	const classGroups = $derived(
		groups
			.filter((item) => item.classId === current?.id)
			.sort((a, b) => a.projectName.localeCompare(b.projectName, 'da'))
	);

	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	function schedule(id: string, path: string, key: string, value: string) {
		const timerKey = path + ':' + id + ':' + key;
		clearTimeout(timers.get(timerKey));
		status = 'Gemmer…';
		timers.set(timerKey, setTimeout(async () => {
			try {
				await updateDoc(doc(getDb(), path, id), { [`values.${key}`]: value, updatedAt: serverTimestamp() });
				status = 'Gemt';
			} catch (error) {
				console.error(error);
				status = 'Kunne ikke gemme.';
			}
		}, 500));
	}

	function fieldKey(label: string, fields: Field[]) {
		const base = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'felt';
		const taken = new Set(fields.map((field) => field.key));
		let key = base;
		let n = 2;
		while (taken.has(key)) {
			key = `${base}-${n}`;
			n += 1;
		}
		return key;
	}

	async function createGroup(event: SubmitEvent) {
		event.preventDefault();
		if (!current || picked.length < 2 || !projectName.trim()) {
			status = 'En gruppe skal have et projektnavn og mindst to elever.';
			return;
		}
		await addDoc(collection(getDb(), 'here_private_groups'), {
			classId: current.id,
			projectName: projectName.trim(),
			studentIds: picked,
			boardUrl: boardUrl.trim(),
			fields: [],
			values: {},
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp()
		});
		projectName = '';
		boardUrl = '';
		picked = [];
		status = 'Gruppe gemt';
	}

	async function addField(group: Group, event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const input = form.querySelector('input');
		const label = input?.value.trim() || '';
		if (!label) return;
		await updateDoc(doc(getDb(), 'here_private_groups', group.id), {
			fields: [...(group.fields || []), { key: fieldKey(label, group.fields || []), label, kind: 'longtext' }],
			updatedAt: serverTimestamp()
		});
		form.reset();
	}

	async function saveNote(event: SubmitEvent) {
		event.preventDefault();
		const data = { title: noteTitle.trim(), body: noteBody.trim(), updatedAt: serverTimestamp() };
		if (noteId) await updateDoc(doc(getDb(), 'here_private_notes', noteId), data);
		else await addDoc(collection(getDb(), 'here_private_notes'), data);
		noteId = '';
		noteTitle = '';
		noteBody = '';
	}

	function date(iso?: string) {
		if (!iso) return '';
		const [year, month, day] = iso.split('-');
		return day ? `${day}.${month}.${year}` : iso;
	}

	$effect(() => {
		if (!authState.isOwner || listening) return;
		listening = true;
		const db = getDb();
		const stops: Unsubscribe[] = [
			onSnapshot(collection(db, 'here_private_classes'), (snap) => {
				classes = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as ClassItem).sort((a, b) => (a.order || 0) - (b.order || 0));
				if (!selectedClassId && classes[0]) selectedClassId = classes[0].id;
			}),
			onSnapshot(collection(db, 'here_private_students'), (snap) => {
				students = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Student);
			}),
			onSnapshot(collection(db, 'here_private_enrollments'), (snap) => {
				enrollments = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Enrollment);
			}),
			onSnapshot(collection(db, 'here_private_groups'), (snap) => {
				groups = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Group);
			}),
			onSnapshot(collection(db, 'here_private_notes'), (snap) => {
				notes = snap.docs
					.map((item) => ({ id: item.id, ...item.data() }) as Note)
					.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
			})
		];
		return () => {
			listening = false;
			stops.forEach((stop) => stop());
		};
	});
</script>

<svelte:head>
	<title>Arbejde</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main>
	{#if !authState.ready}
		<p class="meta">Tjekker login…</p>
	{:else if !authState.isOwner}
		<section id="gate">
			<h1>Arbejde</h1>
			<p>{authState.error || 'Log ind for at se noter og karakterer.'}</p>
			<button type="button" onclick={() => authState.login()}>Log ind</button>
		</section>
	{:else}
		<section>
			<header>
				<h1>Arbejde</h1>
				<div class="row">
					<a href="/" data-sveltekit-reload>Forside</a>
					<button type="button" class="secondary" onclick={() => authState.logout()}>Log ud</button>
				</div>
			</header>
			<p class="meta">{status}</p>
			<nav class="row">
				{#each classes as item}
					<button type="button" class="tab" class:active={item.id === current?.id} onclick={() => (selectedClassId = item.id)}>{item.title}</button>
				{/each}
			</nav>

			{#if current}
				<h2>{current.title}</h2>
				<p class="meta">{[current.year, current.subject, current.level].filter(Boolean).join(' · ')}</p>
				{#each classEnrollments as row}
					<article class="student">
						<h3>{row.student?.name || 'Ukendt elev'}</h3>
						<p class="meta">{[date(row.student?.birthDate), row.enrollment.studyLine, (row.enrollment.groups || []).join(', ')].filter(Boolean).join(' · ')}</p>
						{#each current.fields || [] as field}
							<label>
								<span>{field.label}</span>
								<textarea rows="3" value={row.enrollment.values?.[field.key] || ''} oninput={(event) => schedule(row.enrollment.id, 'here_private_enrollments', field.key, event.currentTarget.value)}></textarea>
							</label>
						{/each}
					</article>
				{/each}

				<h2>Projektgrupper</h2>
				{#each classGroups as group}
					<article class="group">
						<h3>{group.projectName}</h3>
						<p class="meta">
							{group.studentIds.map((id) => students.find((student) => student.id === id)?.name || 'Ukendt elev').sort((a, b) => a.localeCompare(b, 'da')).join(', ')}
						</p>
						{#if group.boardUrl}
							<p><a href={group.boardUrl} target="_blank" rel="noreferrer">Scrumboard</a></p>
						{/if}
						{#each group.fields || [] as field}
							<label>
								<span>{field.label}</span>
								<textarea rows="3" value={group.values?.[field.key] || ''} oninput={(event) => schedule(group.id, 'here_private_groups', field.key, event.currentTarget.value)}></textarea>
							</label>
						{/each}
						<form onsubmit={(event) => addField(group, event)}>
							<input placeholder="Nyt felt" required />
							<button type="submit" class="secondary">Tilføj felt</button>
						</form>
						<button type="button" class="secondary" onclick={() => deleteDoc(doc(getDb(), 'here_private_groups', group.id))}>Slet gruppe</button>
					</article>
				{/each}

				<form onsubmit={createGroup}>
					<label>Projektnavn <input bind:value={projectName} required /></label>
					<label>Scrumboard <input bind:value={boardUrl} placeholder="https://github.com/users/…/projects/1" /></label>
					<div class="checks">
						{#each classEnrollments as row}
							{#if row.student}
								<label class="check">
									<input type="checkbox" checked={picked.includes(row.student.id)} onchange={() => {
										picked = picked.includes(row.student!.id) ? picked.filter((id) => id !== row.student!.id) : [...picked, row.student!.id];
									}} />
									{row.student.name}
								</label>
							{/if}
						{/each}
					</div>
					<button type="submit">Opret gruppe</button>
				</form>
			{/if}

			<section>
				<h2>Arbejdsnoter</h2>
				<form onsubmit={saveNote}>
					<label>Titel <input bind:value={noteTitle} required /></label>
					<label>Note <textarea bind:value={noteBody} rows="5" required></textarea></label>
					<div class="row">
						<button type="submit">Gem note</button>
						{#if noteId}<button type="button" class="secondary" onclick={() => { noteId = ''; noteTitle = ''; noteBody = ''; }}>Annuller</button>{/if}
					</div>
				</form>
				{#each notes as note}
					<article class="card">
						<h3>{note.title || 'Uden titel'}</h3>
						<p>{note.body}</p>
						<div class="row">
							<button type="button" class="secondary" onclick={() => { noteId = note.id; noteTitle = note.title || ''; noteBody = note.body || ''; }}>Ret</button>
							<button type="button" class="secondary" onclick={() => deleteDoc(doc(getDb(), 'here_private_notes', note.id))}>Slet</button>
						</div>
					</article>
				{/each}
			</section>
		</section>
	{/if}
</main>
