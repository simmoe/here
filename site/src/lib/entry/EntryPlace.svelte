<script lang="ts">
	import type { EntryDoc } from '$lib/entry';

	let {
		entry,
		when,
		busy,
		onFetch,
		onSave
	}: {
		entry: EntryDoc | null;
		when: string;
		busy: boolean;
		onFetch: () => void;
		onSave: (place: { name: string; address: string }) => void;
	} = $props();

	let name = $state('');
	let address = $state('');

	$effect(() => {
		name = entry?.place?.name || '';
		address = entry?.place?.address || '';
	});

	const maps = $derived(entry?.place?.mapsUrl || '');
</script>

<p class="section-label">Sted og tid</p>
{#if when}<p class="when">{when}</p>{/if}
<label>Sted <input bind:value={name} /></label>
<label>Adresse <input bind:value={address} /></label>
{#if maps}<p class="actions"><a class="tlink" href={maps} target="_blank" rel="noreferrer">{address || name}</a></p>{/if}
<div class="actions">
	<button type="button" class="tlink" onclick={onFetch} disabled={busy}>{busy ? 'Henter…' : 'Hent fra mail'}</button>
	<button type="button" class="tlink" onclick={() => onSave({ name: name.trim(), address: address.trim() })} disabled={busy}>Gem</button>
	<button type="button" class="tlink" onclick={() => onSave({ name: '', address: '' })} disabled={busy}>Slet</button>
</div>
