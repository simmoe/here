<script lang="ts">
	import { page } from '$app/state';
	import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { authState } from '$lib/auth.svelte';
	import { getDb } from '$lib/firebase/client';
	import ScoreMarks from '$lib/ScoreMarks.svelte';
	import { foldFields, workData, type Enrollment } from '$lib/work.svelte';
	import './work.css';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	let openClasses = $state<string[]>([]);
	let openStudents = $state<string[]>([]);
	let drafts = $state<Record<string, string>>({});
	let followed = '';
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	$effect(() => {
		if (authState.isOwner) workData.listen();
	});

	$effect(() => {
		if (!authState.ready || authState.isOwner || authState.error) return;
		if (sessionStorage.getItem('here-logged-out') === '1') return;
		void authState.login();
	});

	$effect(() => {
		if (path === followed) return;
		followed = path;
		const match = path.match(/^\/work\/hold\/([^/]+)(?:\/([^/]+))?/);
		if (!match) return;
		const classId = match[1];
		const studentId = match[2];
		if (!openClasses.includes(classId)) openClasses = [...openClasses, classId];
		if (studentId) {
			const key = `${classId}:${studentId}`;
			if (!openStudents.includes(key)) openStudents = [...openStudents, key];
		}
	});

	function toggle(list: string[], id: string) {
		return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
	}

	function shown(enrollment: Enrollment, key: string) {
		return drafts[`${enrollment.id}:${key}`] ?? enrollment.values?.[key] ?? '';
	}

	function onLine(enrollment: Enrollment, key: string, value: string) {
		const id = `${enrollment.id}:${key}`;
		drafts[id] = value;
		clearTimeout(timers.get(id));
		timers.set(id, setTimeout(async () => {
			try {
				await updateDoc(doc(getDb(), 'here_private_enrollments', enrollment.id), {
					[`values.${key}`]: value,
					updatedAt: serverTimestamp()
				});
			} catch (error) {
				console.error(error);
			}
		}, 400));
	}
</script>

<svelte:head>
	<title>Arbejde</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="work-shell">
	<aside class="rail">
		<div class="rail-brand">
			<a href="/work">Arbejde</a>
		</div>
		<nav aria-label="Hold">
			{#each workData.classesByYear() as year}
				<p class="section-label">{year.label}</p>
				<ul class="classes">
					{#each year.items as item}
						{@const students = workData.enrollmentsFor(item.id)}
						{@const open = openClasses.includes(item.id)}
						<li>
							<div class="heading">
								<a
									href="/work/hold/{item.id}"
									class:active={path === '/work/hold/' + item.id || path.startsWith('/work/hold/' + item.id + '/')}
								>{item.title}</a>
								<button
									type="button"
									class="fold"
									aria-expanded={open}
									aria-label={open ? `Skjul ${item.title}` : `Vis ${item.title}`}
									onclick={() => (openClasses = toggle(openClasses, item.id))}
								></button>
							</div>
							{#if open}
								<ul class="students">
									{#each students as row}
										{@const studentKey = `${item.id}:${row.enrollment.studentId}`}
										{@const studentOpen = openStudents.includes(studentKey)}
										{@const fields = foldFields(item)}
										<li>
											<div class="heading">
												<a
													href="/work/hold/{item.id}/{row.enrollment.studentId}"
													class:active={path === `/work/hold/${item.id}/${row.enrollment.studentId}`}
												>{row.student?.name || 'Ukendt elev'}</a>
												{#if fields.length}
													<button
														type="button"
														class="fold"
														aria-expanded={studentOpen}
														aria-label={studentOpen ? `Skjul ${row.student?.name || 'elev'}` : `Vis ${row.student?.name || 'elev'}`}
														onclick={() => (openStudents = toggle(openStudents, studentKey))}
													></button>
												{/if}
											</div>
											{#if studentOpen}
												<div class="project">
													{#each fields as field}
														<div class="project-field">
															<span>{field.label}</span>
															{#if field.kind === 'score'}
																<ScoreMarks
																	value={shown(row.enrollment, field.key)}
																	onpick={(value) => onLine(row.enrollment, field.key, value)}
																/>
															{:else}
																<input
																	value={shown(row.enrollment, field.key)}
																	oninput={(event) => onLine(row.enrollment, field.key, event.currentTarget.value)}
																/>
															{/if}
														</div>
													{/each}
												</div>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
		</nav>
		<div class="rail-foot">
			<a href="/" data-sveltekit-reload>Forsiden</a>
			{#if authState.isOwner}
				<button type="button" class="link" onclick={() => authState.logout()}>Log ud</button>
			{/if}
		</div>
	</aside>
	<main class="work-main">
		{#if !authState.ready}
			<p class="status">Logger ind…</p>
		{:else if !authState.isOwner}
			<h2>Log ind</h2>
			{#if authState.error}<p class="status">{authState.error}</p>{/if}
			<button type="button" onclick={() => authState.login()}>Log ind med Google</button>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
