<script lang="ts">
	import { publicData, type Application } from '$lib/public.svelte';

	let selected = $state('');

	const app = $derived(publicData.applications.find((item) => item.id === selected) || publicData.applications[0]);

	$effect(() => {
		if (!selected && publicData.applications[0]) selected = publicData.applications[0].id;
	});

	function paragraphs(item: Application) {
		return (item.content || []).filter((line) => line !== '---');
	}
</script>

<svelte:head><title>Ansøgning</title></svelte:head>

<div class="page show" id="page-application">
	<div id="application-container">
		<div class="application-controls no-print">
			<select class="app-selector" bind:value={selected}>
				{#each publicData.applications as item}
					<option value={item.id}>{item.title}</option>
				{/each}
			</select>
			<div class="print-buttons">
				<a href="/print?id={app?.id}&type=full" target="_blank">Alt</a>
				<a href="/print?id={app?.id}&type=letter" target="_blank">Ansøgning</a>
				<a href="/print?id={app?.id}&type=cv" target="_blank">CV</a>
				<a href="/print?id={app?.id}&type=recommendations" target="_blank">Anbefalinger</a>
			</div>
		</div>
		{#if app}
			<article class="application-document">
				<header class="doc-header">
					<div class="sender-info">
						<h3 class="sender-name">{publicData.contact.name}</h3>
						<p class="sender-phone">{publicData.contact.phone}</p>
					</div>
					<div class="recipient-info">
						<p class="recipient-company" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="recipient.company">{app.recipient?.company}</p>
						<p class="recipient-attn" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="recipient.attn">{app.recipient?.attn}</p>
						<p class="recipient-address" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="recipient.address">{app.recipient?.address}</p>
						<p class="recipient-zip" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="recipient.zip">{app.recipient?.zip}</p>
					</div>
				</header>
				<main class="letter-content">
					<p class="letter-meta date" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="date">{app.date}</p>
					<h1 class="letter-title" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="title">{app.title}</h1>
					<div class="letter-body">
						<div class="editable-content" data-edit-collection="here_applications" data-edit-doc={app.id} data-edit-field="content" data-edit-array="true">
							{#each paragraphs(app) as paragraph}
								<p>{paragraph}</p>
							{/each}
						</div>
						{#if app.useSignature && publicData.contact.signature}
							<img class="signature-img" src={publicData.contact.signature} alt="" />
						{/if}
					</div>
				</main>
			</article>
		{/if}
	</div>
</div>
