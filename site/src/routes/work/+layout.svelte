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

	function current(href: string) {
		return path === href || (href !== '/work' && path.startsWith(href));
	}
</script>

<svelte:head>
	<title>Arbejde</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="work-shell">
	<aside class="work-side">
		<h1>Arbejde</h1>
		<a href="/work" class:active={path === '/work'}>Oversigt</a>
		<nav class="sub" aria-label="Hold">
			{#each workData.classes as item}
				<a href="/work/hold/{item.id}" class:active={current('/work/hold/' + item.id)}>{item.title}</a>
			{/each}
		</nav>
		<a href="/work/noter" class:active={current('/work/noter')}>Noter</a>
		<div class="bottom">
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
