<script lang="ts">
	import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
	import { getDb } from '$lib/firebase/client';
	import { workData } from '$lib/work.svelte';

	let noteId = $state('');
	let title = $state('');
	let body = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const data = { title: title.trim(), body: body.trim(), updatedAt: serverTimestamp() };
		if (noteId) await updateDoc(doc(getDb(), 'here_private_notes', noteId), data);
		else await addDoc(collection(getDb(), 'here_private_notes'), data);
		noteId = '';
		title = '';
		body = '';
	}
</script>

<h2>Noter</h2>
<form class="work-form" onsubmit={save}>
	<label>Titel <input bind:value={title} required /></label>
	<label>Note <textarea bind:value={body} rows="5" required></textarea></label>
	<div class="row">
		<button type="submit">Gem note</button>
		{#if noteId}
			<button type="button" class="secondary" onclick={() => { noteId = ''; title = ''; body = ''; }}>Annuller</button>
		{/if}
	</div>
</form>
{#each workData.notes as note}
	<article class="card">
		<h3>{note.title || 'Uden titel'}</h3>
		<p>{note.body}</p>
		<div class="row">
			<button type="button" class="secondary" onclick={() => { noteId = note.id; title = note.title || ''; body = note.body || ''; }}>Ret</button>
			<button type="button" class="secondary" onclick={() => deleteDoc(doc(getDb(), 'here_private_notes', note.id))}>Slet</button>
		</div>
	</article>
{/each}
