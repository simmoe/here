<script lang="ts">
	import { onMount } from 'svelte';
	import { authState } from '$lib/auth.svelte';
	import { publicData } from '$lib/public.svelte';

	let { children } = $props();

	onMount(() => {
		// Seeded snapshot paints first. Firebase (~670KB) waits so it does not fight the first paint.
		const boot = () => {
			publicData.load();
			authState.init();
		};
		const timer = window.setTimeout(boot, 4000);
		const onInteract = () => {
			window.clearTimeout(timer);
			boot();
		};
		window.addEventListener('pointerdown', onInteract, { once: true });
		window.addEventListener('keydown', onInteract, { once: true });
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener('pointerdown', onInteract);
			window.removeEventListener('keydown', onInteract);
		};
	});
</script>

{@render children()}
