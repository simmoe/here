<script lang="ts">
	import FrontParticles from '$lib/FrontParticles.svelte';
	import { publicData } from '$lib/public.svelte';

	const front = $derived(publicData.sitemeta.frontpage);
</script>

<svelte:head><title>Du er her</title></svelte:head>

<div class="page show" id="page1">
	<div id="frontpage-content">
		{#if publicData.error}
			<p>{publicData.error}</p>
		{:else if front}
			<h1 data-edit-collection="here_content" data-edit-doc="meta" data-edit-field="frontpage.heading">
				{front.heading}
			</h1>
			<p class="tagline" data-edit-collection="here_content" data-edit-doc="meta" data-edit-field="frontpage.tagline">
				{front.tagline}
			</p>
			<div class="statement">
				<p data-edit-collection="here_content" data-edit-doc="meta" data-edit-field="frontpage.statement">{@html (front.statement || '').replaceAll('\n', '<br/>')}</p>
			</div>
		{/if}
	</div>
	<FrontParticles />
</div>
