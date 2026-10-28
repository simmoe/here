<script lang="ts">
	import { projectCategories, publicData } from '$lib/public.svelte';

	let filter = $state('all');

	function visible(categories: string[]) {
		return filter === 'all' || categories.includes(filter);
	}

	function titles(categories: string[]) {
		return categories
			.map((id) => projectCategories.find((category) => category.id === id)?.title || id)
			.join(', ');
	}
</script>

<svelte:head><title>Projekter</title></svelte:head>

<div class="page show" id="page3">
	<div id="project-filter">
		<button type="button" class="filter-btn" class:active={filter === 'all'} onclick={() => (filter = 'all')}>Alle</button>
		{#each projectCategories as category}
			<button type="button" class="filter-btn" class:active={filter === category.id} onclick={() => (filter = category.id)}>
				{category.title}
			</button>
		{/each}
	</div>
	<div id="projects">
		{#each publicData.projects as project, index}
			<article
				onmouseenter={(event) => event.currentTarget.querySelector('video')?.play()}
				onmouseleave={(event) => {
					const video = event.currentTarget.querySelector('video');
					if (!video) return;
					video.pause();
					video.currentTime = 0;
				}}
				class="project-card"
				data-categories={project.categories.join(',')}
				style:display={visible(project.categories) ? 'flex' : 'none'}
				style:--start-distance="30px"
				style:animation="project-appear 0.6s ease-out {index * 50}ms both"
			>
				<div class="project-media-container">
					<div class="project-content">
						{#if project.year}<p class="project-year">{project.year}</p>{/if}
						<h3 class="project-title">{project.title}</h3>
						<p class="project-category">{titles(project.categories)}</p>
						{#if project.context}<p class="project-context">{project.context}</p>{/if}
						{#if project.description}<p class="project-description">{@html project.description}</p>{/if}
						{#each project.links || [] as link}
							<a class="project-link" href={link} target="_blank" rel="noreferrer"><span>Læs mere (PDF)</span></a>
						{/each}
					</div>
					<div class="media-wrapper">
						{#if project.video}
							<video src={project.video} muted loop playsinline></video>
						{:else}
							{#each project.images || [] as src, imageIndex}
								<img class:slide-image={(project.images || []).length > 1} class:active={imageIndex === 0} {src} alt="" style:object-fit={project.imageFit} />
							{/each}
						{/if}
					</div>
				</div>
			</article>
		{/each}
	</div>
</div>
