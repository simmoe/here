<script lang="ts">
	import { page } from '$app/state';
	import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { getDb } from '$lib/firebase/client';
	import { formatDate, workData, type Group } from '$lib/work.svelte';

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

	const timers = new Map<string, ReturnType<typeof setTimeout>>();

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
	<h2>{current.title}</h2>
	<p class="meta">{[current.year, current.subject, current.level].filter(Boolean).join(' · ')}</p>
	<p class="status">{status}</p>
	<ul class="work-list">
		{#each rows as row}
			<li>
				<a href="/work/hold/{classId}/{row.enrollment.studentId}">
					<span>{row.student?.name || 'Ukendt elev'}</span>
					<span class="meta">{[formatDate(row.student?.birthDate), row.enrollment.studyLine].filter(Boolean).join(' · ')}</span>
				</a>
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
