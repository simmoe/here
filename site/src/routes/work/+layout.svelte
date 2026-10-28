<script lang="ts">
	import { page } from '$app/state';
	import { authState } from '$lib/auth.svelte';
	import { workData } from '$lib/work.svelte';
	import './work.css';

	let { children } = $props();

	const path = $derived(page.url.pathname);

	$effect(() => {
		if (authState.isOwner) workData.listen();
	});

	$effect(() => {
		if (!authState.ready || authState.isOwner || authState.error) return;
		if (sessionStorage.getItem('here-logged-out') === '1') return;
		void authState.login();
	});
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
						<li>
							<a
								href="/work/hold/{item.id}"
								class:active={path === '/work/hold/' + item.id || path.startsWith('/work/hold/' + item.id + '/')}
							>{item.title}</a>
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
