<script lang="ts">
	import { workData } from '$lib/work.svelte';
</script>

<h2>Hold</h2>
<p class="meta">Eleverne åbner på deres egen side.</p>
<ul class="work-list">
	{#each workData.classes as item}
		<li>
			<a href="/work/hold/{item.id}">
				<span>{item.title}</span>
				<span class="meta">{workData.enrollmentsFor(item.id).length}</span>
			</a>
		</li>
	{/each}
</ul>
