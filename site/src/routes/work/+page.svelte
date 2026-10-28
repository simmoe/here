<script lang="ts">
	import { workData } from '$lib/work.svelte';
</script>

{#each workData.classesByYear() as year}
	<h2>{year.label}</h2>
	<ul class="work-list">
		{#each year.items as item}
			<li>
				<a href="/work/hold/{item.id}">
					<span>{item.title}</span>
					<span class="meta">{workData.enrollmentsFor(item.id).length}</span>
				</a>
			</li>
		{/each}
	</ul>
{/each}
