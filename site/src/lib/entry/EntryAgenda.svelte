<script lang="ts">
	import type { EntryDoc } from '$lib/entry';

	let {
		entry,
		busy,
		onFetch,
		onSave
	}: {
		entry: EntryDoc | null;
		busy: boolean;
		onFetch: () => void;
		onSave: (text: string) => void;
	} = $props();

	let text = $state('');

	$effect(() => {
		text = entry?.agenda?.text || '';
	});
</script>

<h3>Dagsorden</h3>
{#if entry?.agenda?.fileUrl}
	<p><a href={entry.agenda.fileUrl} target="_blank" rel="noreferrer">PDF</a></p>
{/if}
<label>Tekst <textarea bind:value={text} rows="14"></textarea></label>
<div class="row">
	<button type="button" onclick={onFetch} disabled={busy}>Hent fra mail</button>
	<button type="button" class="secondary" onclick={() => onSave(text.trim())} disabled={busy}>Gem</button>
	<button type="button" class="secondary" onclick={() => onSave('')} disabled={busy}>Slet</button>
</div>
