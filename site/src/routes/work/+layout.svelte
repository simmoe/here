<script lang="ts">
	import { page } from '$app/state';
	import { authState } from '$lib/auth.svelte';
	import { workData } from '$lib/work.svelte';
	import './work.css';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	const waiting = $derived(!authState.ready || authState.busy || !authState.isOwner);

	$effect(() => {
		if (authState.isOwner) workData.listen();
	});

	$effect(() => {
		if (!authState.ready || authState.isOwner || authState.busy) return;
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

{#if waiting}
	<div class="work-gate">
		<img src="/assets/moelogo.png" alt="" width="72" height="72" />
		{#if authState.error}
			<p class="status">{authState.error}</p>
		{/if}
	</div>
{:else}
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
				<button type="button" class="link" onclick={() => authState.logout()}>Log ud</button>
			</div>
		</aside>
		<main class="work-main">
			{@render children()}
		</main>
	</div>
{/if}
