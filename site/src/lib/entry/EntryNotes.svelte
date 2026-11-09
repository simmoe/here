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

<h3>Noter</h3>
<label>Tekst <textarea bind:value={raw} rows="8"></textarea></label>
<label>Resumé <textarea bind:value={summary} rows="8"></textarea></label>
<div class="row">
	<button type="button" onclick={onWrite} disabled={busy}>Lav noter</button>
	<button type="button" class="secondary" onclick={() => onSave({ raw: raw.trim(), summary: summary.trim() })} disabled={busy}>Gem</button>
	<button type="button" class="secondary" onclick={() => onSave({ raw: '', summary: '' })} disabled={busy}>Slet</button>
</div>
