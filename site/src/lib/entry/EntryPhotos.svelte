<script lang="ts">
	import type { EntryDoc } from '$lib/entry';

	let {
		entry,
		when,
		busy,
		onCamera,
		onPick,
		onConfirm,
		onRemove
	}: {
		entry: EntryDoc | null;
		when: string;
		busy: boolean;
		onCamera: (file: File) => void;
		onPick: () => void;
		onConfirm: (index: number) => void;
		onRemove: (index: number) => void;
	} = $props();
</script>

<h3>Billeder</h3>
{#if when}<p class="when">{when}</p>{/if}
<div class="row">
	<label class="file">
		Kamera
		<input
			type="file"
			accept="image/*"
			capture="environment"
			disabled={busy}
			onchange={(event) => {
				const file = event.currentTarget.files?.[0];
				event.currentTarget.value = '';
				if (file) onCamera(file);
			}}
		/>
	</label>
	<button type="button" onclick={onPick} disabled={busy}>Google Photos</button>
</div>
<ul class="shots">
	{#each entry?.photos || [] as photo, index}
		<li>
			<img src={photo.url} alt="" />
			<div class="row">
				{#if photo.confirmed}
					<span>Bekræftet</span>
				{:else}
					<button type="button" onclick={() => onConfirm(index)} disabled={busy}>Bekræft</button>
				{/if}
				<button type="button" class="secondary" onclick={() => onRemove(index)} disabled={busy}>Slet</button>
			</div>
		</li>
	{/each}
</ul>
