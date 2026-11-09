<script lang="ts">
	import { skills } from '$lib/skills';
</script>

<svelte:head><title>Skills</title></svelte:head>

<h2>Skills</h2>
<div class="skill-grid">
	{#each skills as skill (skill.id)}
		<article class="skill-card">
			<h3>{skill.title}</h3>
			<p>{skill.description}</p>
		</article>
	{/each}
</div>
