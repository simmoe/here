<script lang="ts">
	import { onMount } from 'svelte';
	import { authState } from '$lib/auth.svelte';
	import { publicData } from '$lib/public.svelte';

	let { children } = $props();

	onMount(() => {
		publicData.load();
		const bootAuth = () => authState.init();
		if (typeof requestIdleCallback === 'function') requestIdleCallback(bootAuth, { timeout: 2000 });
		else setTimeout(bootAuth, 1);
	});
</script>

{@render children()}
