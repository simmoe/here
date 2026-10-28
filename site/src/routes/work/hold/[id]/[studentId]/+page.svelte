<script lang="ts">
	import { page } from '$app/state';
	import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { getDb } from '$lib/firebase/client';
	import ScoreMarks from '$lib/ScoreMarks.svelte';
	import { formatDate, workData } from '$lib/work.svelte';

	const classId = $derived(page.params.id ?? '');
	const studentId = $derived(page.params.studentId ?? '');
	const current = $derived(workData.classes.find((item) => item.id === classId));
	const row = $derived(workData.enrollmentsFor(classId).find((item) => item.enrollment.studentId === studentId));
	let status = $state('');
	let drafts = $state<Record<string, string>>({});
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	function schedule(enrollmentId: string, key: string, value: string) {
		clearTimeout(timers.get(key));
		status = 'Gemmer…';
		timers.set(key, setTimeout(async () => {
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
		}, 500));
	}
</script>

<p class="meta"><a href="/work/hold/{classId}">{current?.title || 'Hold'}</a></p>
{#if row}
	<h2>{row.student?.name || 'Ukendt elev'}</h2>
	<p class="meta">{[formatDate(row.student?.birthDate), row.enrollment.studyLine, (row.enrollment.groups || []).join(', ')].filter(Boolean).join(' · ')}</p>
	<p class="status">{status}</p>
	{#each current?.fields || [] as field}
		{#if field.kind === 'score'}
			<div class="project-field">
				<span>{field.label}</span>
				<ScoreMarks
					value={drafts[field.key] ?? row.enrollment.values?.[field.key] ?? ''}
					onpick={(value) => {
						drafts[field.key] = value;
						schedule(row.enrollment.id, field.key, value);
					}}
				/>
			</div>
		{:else}
			<label>
				<span>{field.label}</span>
				{#if field.kind === 'line'}
					<input value={row.enrollment.values?.[field.key] || ''} oninput={(event) => schedule(row.enrollment.id, field.key, event.currentTarget.value)} />
				{:else}
					<textarea rows="8" value={row.enrollment.values?.[field.key] || ''} oninput={(event) => schedule(row.enrollment.id, field.key, event.currentTarget.value)}></textarea>
				{/if}
			</label>
		{/if}
	{/each}
	{#if !(current?.fields || []).length}
		<p class="meta">Der er ingen felter på holdet endnu.</p>
	{/if}
{:else}
	<p class="meta">Eleven er ikke på holdet.</p>
{/if}
