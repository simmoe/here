<script lang="ts">
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { getDb } from '$lib/firebase/client';
	import ScoreMarks from '$lib/ScoreMarks.svelte';
	import { formatDate, yearLabel, workData, type Group } from '$lib/work.svelte';

	const classId = $derived(page.params.id ?? '');
	const current = $derived(workData.classes.find((item) => item.id === classId));
	const rows = $derived(workData.enrollmentsFor(classId));
	const groups = $derived(
		workData.groups
			.filter((item) => item.classId === classId)
			.sort((a, b) => a.projectName.localeCompare(b.projectName, 'da'))
	);

	let projectName = $state('');
	let boardUrl = $state('');
	let picked = $state<string[]>([]);
	let status = $state('');
	let openId = $state<string | null>(null);
	let drafts = $state<Record<string, string>>({});
	let seenHash = '';

	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const slideOpts = { duration: 280, easing: cubicOut };

	const openRow = $derived(rows.find((row) => row.enrollment.studentId === openId) ?? null);

	$effect(() => {
		const hash = page.url.hash;
		const key = classId + hash;
		if (key === seenHash) return;
		seenHash = key;
		openId = hash.replace(/^#/, '') || null;
	});

	function toggleStudent(id: string) {
		openId = openId === id ? null : id;
	}

	function shown(enrollmentId: string, key: string, stored?: string) {
		const id = `${enrollmentId}:${key}`;
		return drafts[id] ?? stored ?? '';
	}

	function saveEnrollment(enrollmentId: string, key: string, value: string) {
		const id = `${enrollmentId}:${key}`;
		drafts[id] = value;
		clearTimeout(timers.get(id));
		status = 'Gemmer…';
		timers.set(id, setTimeout(async () => {
			try {
				await updateDoc(doc(getDb(), 'here_private_enrollments', enrollmentId), {
					[`values.${key}`]: value,
					updatedAt: serverTimestamp()
				});
				status = 'Gemt';
			} catch (error) {
				console.error(error);
				status = 'Kunne ikke gemme.';
			}
		}, 400));
	}

	function names(ids: string[]) {
		return ids
			.map((id) => workData.student(id)?.name || 'Ukendt elev')
			.sort((a, b) => a.localeCompare(b, 'da'))
			.join(', ');
	}

	function schedule(groupId: string, key: string, value: string) {
		const timerKey = groupId + ':' + key;
		clearTimeout(timers.get(timerKey));
		status = 'Gemmer…';
		timers.set(timerKey, setTimeout(async () => {
			try {
				await updateDoc(doc(getDb(), 'here_private_groups', groupId), {
					[`values.${key}`]: value,
					updatedAt: serverTimestamp()
				});
				status = 'Gemt';
			} catch (error) {
				console.error(error);
				status = 'Kunne ikke gemme.';
			}
		}, 500));
	}

	function fieldKey(label: string, group: Group) {
		const base = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'felt';
		const taken = new Set((group.fields || []).map((field) => field.key));
		let key = base;
		let n = 2;
		while (taken.has(key)) key = `${base}-${n++}`;
		return key;
	}

	async function addField(group: Group, event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const label = (form.querySelector('input')?.value || '').trim();
		if (!label) return;
		await updateDoc(doc(getDb(), 'here_private_groups', group.id), {
			fields: [...(group.fields || []), { key: fieldKey(label, group), label, kind: 'longtext' }],
			updatedAt: serverTimestamp()
		});
		form.reset();
	}

	function toggle(id: string) {
		picked = picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id];
	}

	async function createGroup(event: SubmitEvent) {
		event.preventDefault();
		if (picked.length < 2 || !projectName.trim()) {
			status = 'En gruppe skal have et projektnavn og mindst to elever.';
			return;
		}
		await addDoc(collection(getDb(), 'here_private_groups'), {
			classId,
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
</script>

{#if current}
	<nav class="crumb" aria-label="Sti">
		<a href="/work">Arbejde</a>
		<span aria-hidden="true">/</span>
		<span>{yearLabel(current.year)}</span>
		<span aria-hidden="true">/</span>
		{#if openRow}
			<button type="button" class="crumb-link" onclick={() => (openId = null)}>{current.title}</button>
			<span aria-hidden="true">/</span>
			<span class="here">{openRow.student?.name || 'Ukendt elev'}</span>
		{:else}
			<span class="here">{current.title}</span>
		{/if}
	</nav>
	<h2>{current.title}</h2>
	<p class="meta">{[current.subject, current.level].filter(Boolean).join(' · ')}</p>
	<p class="status">{status}</p>
	<ul class="pupils">
		{#each rows as row}
			{@const open = openId === row.enrollment.studentId}
			<li class:open>
				<button
					type="button"
					class="pupil"
					aria-expanded={open}
					onclick={() => toggleStudent(row.enrollment.studentId)}
				>
					<span>{row.student?.name || 'Ukendt elev'}</span>
					<span class="meta">{[formatDate(row.student?.birthDate), row.enrollment.studyLine].filter(Boolean).join(' · ')}</span>
					<span class="chevron" aria-hidden="true"></span>
				</button>
				{#if open}
					<div class="pupil-body" transition:slide={slideOpts}>
						{#each current.fields || [] as field}
							{#if field.kind === 'score'}
								<div class="project-field">
									<span>{field.label}</span>
									<ScoreMarks
										value={shown(row.enrollment.id, field.key, row.enrollment.values?.[field.key])}
										onpick={(value) => saveEnrollment(row.enrollment.id, field.key, value)}
									/>
								</div>
							{:else}
								<label>
									<span>{field.label}</span>
									{#if field.kind === 'line'}
										<input
											value={shown(row.enrollment.id, field.key, row.enrollment.values?.[field.key])}
											oninput={(event) => saveEnrollment(row.enrollment.id, field.key, event.currentTarget.value)}
										/>
									{:else}
										<textarea
											rows="4"
											value={shown(row.enrollment.id, field.key, row.enrollment.values?.[field.key])}
											oninput={(event) => saveEnrollment(row.enrollment.id, field.key, event.currentTarget.value)}
										></textarea>
									{/if}
								</label>
							{/if}
						{/each}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<h2 style:margin-top="2.5rem">Projektgrupper</h2>
	{#each groups as group}
		<article class="group">
			<h3>{group.projectName}</h3>
			<p class="meta">{names(group.studentIds)}</p>
			{#if group.boardUrl}<p><a href={group.boardUrl} target="_blank" rel="noreferrer">Scrumboard</a></p>{/if}
			{#each group.fields || [] as field}
				<label>
					<span>{field.label}</span>
					<textarea rows="3" value={group.values?.[field.key] || ''} oninput={(event) => schedule(group.id, field.key, event.currentTarget.value)}></textarea>
				</label>
			{/each}
			<form class="row" onsubmit={(event) => addField(group, event)}>
				<input placeholder="Nyt felt" required />
				<button type="submit" class="secondary">Tilføj felt</button>
			</form>
			<button type="button" class="secondary" onclick={() => deleteDoc(doc(getDb(), 'here_private_groups', group.id))}>Slet gruppe</button>
		</article>
	{/each}

	<form class="work-form" onsubmit={createGroup}>
		<label>Projektnavn <input bind:value={projectName} required /></label>
		<label>Scrumboard <input bind:value={boardUrl} placeholder="https://github.com/users/…/projects/1" /></label>
		<div class="checks">
			{#each rows as row}
				{#if row.student}
					<label class="check">
						<input type="checkbox" checked={picked.includes(row.student.id)} onchange={() => toggle(row.student!.id)} />
						{row.student.name}
					</label>
				{/if}
			{/each}
		</div>
		<button type="submit">Opret gruppe</button>
	</form>
{:else}
	<p class="meta">Holdet findes ikke.</p>
{/if}
