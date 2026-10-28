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
		const logo = () => shell?.querySelector<HTMLElement>('.home-logo');
		let targetX = 0;
		let targetY = 0;
		let currentX = 0;
		let currentY = 0;
		let frame = 0;
		const onMove = (event: MouseEvent) => {
			const node = logo();
			if (!node) return;
			const rect = node.getBoundingClientRect();
			targetX = event.clientX - (rect.left + rect.width / 2);
			targetY = event.clientY - (rect.top + rect.height / 2);
		};
		const tick = () => {
			currentX += (targetX - currentX) * 0.1;
			currentY += (targetY - currentY) * 0.1;
			logo()?.style.setProperty('--mouse-dx', currentX.toFixed(2) + 'px');
			logo()?.style.setProperty('--mouse-dy', currentY.toFixed(2) + 'px');
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		const onKey = (event: KeyboardEvent) => {
			if (event.key === '4' && (event.ctrlKey || event.metaKey)) {
				event.preventDefault();
				void goto('/ansoegning');
				if (!authState.isOwner) void authState.login();
			}
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('keydown', onKey);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

<div bind:this={shell} role="presentation">
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
		<a
			class="work-login"
			href="/work"
			onclick={(event) => {
				if (authState.isOwner) return;
				event.preventDefault();
				void authState.login();
			}}>{authState.isOwner ? 'Arbejde' : 'Log ind'}</a
		>
	{/if}
	{@render children()}
</div>
