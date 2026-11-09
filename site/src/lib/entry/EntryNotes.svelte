<script lang="ts">
	import type { EntryDoc } from '$lib/entry';

	let {
		entry,
		busy,
		onWrite,
		onSave
	}: {
		entry: EntryDoc | null;
		busy: boolean;
		onWrite: () => void;
		onSave: (notes: { raw: string; summary: string }) => void;
	} = $props();

	let raw = $state('');
	let summary = $state('');

	$effect(() => {
		raw = entry?.notes?.raw || '';
		summary = entry?.notes?.summary || '';
	});
</script>

<p class="section-label">Noter</p>
<label>Tekst <textarea bind:value={raw} rows="8"></textarea></label>
<label>Resumé <textarea bind:value={summary} rows="8"></textarea></label>
<div class="actions">
	<button type="button" class="tlink" onclick={onWrite} disabled={busy}>{busy ? 'Skriver…' : 'Lav noter'}</button>
	<button type="button" class="tlink" onclick={() => onSave({ raw: raw.trim(), summary: summary.trim() })} disabled={busy}>Gem</button>
	<button type="button" class="tlink" onclick={() => onSave({ raw: '', summary: '' })} disabled={busy}>Slet</button>
</div>
