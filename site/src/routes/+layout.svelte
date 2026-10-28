<script lang="ts">
	import { onMount } from 'svelte';
	import { authState } from '$lib/auth.svelte';
	import { publicData } from '$lib/public.svelte';

	let { children } = $props();

	onMount(() => {
		authState.init();
		publicData.load();
	});
</script>

{@render children()}
