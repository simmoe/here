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

<h3>Sted og tid</h3>
{#if when}<p class="when">{when}</p>{/if}
<label>Sted <input bind:value={name} /></label>
<label>Adresse <input bind:value={address} /></label>
{#if maps}<p><a href={maps} target="_blank" rel="noreferrer">{address || name}</a></p>{/if}
<div class="row">
	<button type="button" onclick={onFetch} disabled={busy}>Hent fra mail</button>
	<button type="button" class="secondary" onclick={() => onSave({ name: name.trim(), address: address.trim() })} disabled={busy}>Gem</button>
	<button type="button" class="secondary" onclick={() => onSave({ name: '', address: '' })} disabled={busy}>Slet</button>
</div>
