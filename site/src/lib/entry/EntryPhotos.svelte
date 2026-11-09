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

<p class="section-label">Billeder</p>
{#if when}<p class="when">{when}</p>{/if}
<div class="actions">
	<label class="file tlink">
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
	<button type="button" class="tlink" onclick={onPick} disabled={busy}>Google Photos</button>
</div>
<ul class="shots">
	{#each entry?.photos || [] as photo, index}
		<li>
			<img src={photo.url} alt="" />
			<div class="actions">
				{#if photo.confirmed}
					<span class="meta">Bekræftet</span>
				{:else}
					<button type="button" class="tlink" onclick={() => onConfirm(index)} disabled={busy}>Bekræft</button>
				{/if}
				<button type="button" class="tlink" onclick={() => onRemove(index)} disabled={busy}>Slet</button>
			</div>
		</li>
	{/each}
</ul>
