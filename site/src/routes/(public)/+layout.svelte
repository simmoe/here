<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import '../../../../index.css';
	import { authState } from '$lib/auth.svelte';
	import { enableOwnerEditing } from '$lib/edit';

	let { children } = $props();
	let shell: HTMLElement;

	const printing = $derived(page.url.pathname.startsWith('/print'));
	const path = $derived(page.url.pathname);

	$effect(() => {
		if (!authState.isOwner || !shell) return;
		return enableOwnerEditing(shell);
	});

	onMount(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === '4' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				void goto('/ansoegning');
				if (!authState.isOwner) void authState.login();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function logoMove(event: MouseEvent) {
		const logo = shell?.querySelector<HTMLElement>('.home-logo');
		if (!logo) return;
		const rect = logo.getBoundingClientRect();
		logo.style.setProperty('--mouse-dx', event.clientX - (rect.left + rect.width / 2) + 'px');
		logo.style.setProperty('--mouse-dy', event.clientY - (rect.top + rect.height / 2) + 'px');
	}
</script>

<div bind:this={shell} onmousemove={logoMove} role="presentation">
	{#if !printing}
		<div class="menu-wrapper">
			<div class="burger-icon">≡</div>
			<div class="sidebar">
				<a class="menu-link home-logo" class:active={path === '/'} href="/">
					<img src="/assets/moelogo.png" alt="Hjem" />
					<span>Hjem</span>
				</a>
				<a class="menu-link" class:active={path === '/cv'} href="/cv">CV</a>
				<a class="menu-link" class:active={path === '/projekter'} href="/projekter">Projekter</a>
			</div>
		</div>
		<a class="work-login" href="/arbejde" data-sveltekit-reload>Log ind</a>
	{/if}
	{@render children()}
</div>
