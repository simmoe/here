<script lang="ts">
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { getDb } from '$lib/firebase/client';
	import ScoreMarks from '$lib/ScoreMarks.svelte';
	import { formatDate, yearLabel, workData } from '$lib/work.svelte';

	const classId = $derived(page.params.id ?? '');
	const current = $derived(workData.classes.find((item) => item.id === classId));
	const rows = $derived(workData.enrollmentsFor(classId));

	let status = $state('');
	let openId = $state<string | null>(null);
	let drafts = $state<Record<string, string>>({});
	let seenHash = '';

	const timers = new Map<string, ReturnType<typeof setTimeout>>();
	const slideOpts = { duration: 280, easing: cubicOut };

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

</script>

{#if current}
	<nav class="crumb" aria-label="Sti">
		<a href="/work">Arbejde</a>
		<span aria-hidden="true">/</span>
		<span>{yearLabel(current.year)}</span>
		<span aria-hidden="true">/</span>
		<span class="here">{current.title}</span>
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
					<span class="chevron" aria-hidden="true"></span>
					<span class="name">{row.student?.name || 'Ukendt elev'}</span>
					<span class="meta">{[formatDate(row.student?.birthDate), row.enrollment.studyLine].filter(Boolean).join(' · ')}</span>
				</button>
				{#if open}
					<div class="pupil-body" transition:slide={slideOpts}>
						{#each current.fields || [] as field}
							{#if field.kind === 'score'}
								<div class="setting">
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
{:else}
	<p class="meta">Holdet findes ikke.</p>
{/if}
