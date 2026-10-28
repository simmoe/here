<script lang="ts">
	import { cvCategories, publicData, type CvJob } from '$lib/public.svelte';

	let filter = $state('all');

	const jobs = $derived(
		publicData.cv.entries.filter((job) => filter === 'all' || job.category === filter)
	);

	function years(job: CvJob) {
		if (job.endYear && job.endYear !== job.startYear) return `${job.startYear} - ${job.endYear}`;
		return String(job.startYear || '');
	}

	function refsFor(job: CvJob) {
		return publicData.recommendations.filter((rec) => rec.cvRefs?.includes(job.id));
	}
</script>

<svelte:head><title>CV</title></svelte:head>

<div class="page show" id="page2">
	<div id="cv-filter">
		<span class="filter-btn" class:active={filter === 'all'} role="button" tabindex="0" onclick={() => (filter = 'all')} onkeydown={(event) => event.key === 'Enter' && (filter = 'all')}>Alle</span>
		{#each cvCategories as category}
			<span class="filter-btn" class:active={filter === category.id} role="button" tabindex="0" onclick={() => (filter = category.id)} onkeydown={(event) => event.key === 'Enter' && (filter = category.id)}>{category.title}</span>
		{/each}
	</div>
	<div id="cv-top">
		<hr class="cv-top-divider" />
		<div id="cv-resume">{publicData.cv.resumeShort}</div>
		<hr class="cv-top-divider" />
	</div>
	<div id="cv">
		<div class="vertical-line" style:grid-row="1 / span {Math.max(jobs.length, 1)}"></div>
		{#each jobs as job, index}
			{@const references = refsFor(job)}
			<div
				class="cv-wrapper cv-animate {index % 2 === 0 ? 'left' : 'right'} {job.category ? 'cat-' + job.category : ''}"
				style:grid-row={index + 1}
				style:--start-distance="{20 + index * 2}px"
				style:animation="cv-pearl 0.45s ease-out {index * 50}ms both"
			>
				<div
					class="cv-entry"
					onmouseenter={(event) => event.currentTarget.parentElement?.classList.add('show-details')}
					onmouseleave={(event) => {
						const wrapper = event.currentTarget.parentElement;
						wrapper?.classList.remove('show-details');
						wrapper?.querySelectorAll('.cv-recommendation.open').forEach((node) => node.classList.remove('open'));
					}}
					role="presentation"
				>
					<div class="cv-year">{years(job)}</div>
					<div class="cv-title-wrapper">
						<h3 class="cv-title">{job.title}</h3>
						<svg class="cv-arrow" width="12" height="12" viewBox="0 0 12 12">
							<path d="M3 4 L6 8 L9 4 Z" fill="black" />
						</svg>
					</div>
					<p class="cv-place">{job.place}</p>
					<p class="cv-read-more">Læs mere</p>
					<div class="cv-details">
						{#if job.image}<img class="cv-image" src={job.image} alt="" />{/if}
						{#if job.description}<p class="cv-description">{@html job.description}</p>{/if}
						{#if job.detail}<p class="cv-detail-text">{@html job.detail}</p>{/if}
						{#if job.link || references.length}
							<div class="cv-meta-section">
								{#if job.link}
									<a class="cv-link" href={job.link.url} target="_blank" rel="noreferrer">
										<span>{job.link.text}</span>
									</a>
								{/if}
								{#if references.length}
									<div class="cv-recommendation">
										<button type="button" class="cv-rec-toggle" onclick={(event) => event.currentTarget.parentElement?.classList.toggle('open')}>
											{references.length > 1 ? 'Referencer' : 'Reference'}
										</button>
										<div class="cv-rec-content">
											{#each references as rec}
												<div class="cv-rec-item">
													<p class="cv-rec-quote">"{rec.short || rec.quote}"</p>
													<p class="cv-rec-author">- {rec.author}{rec.role ? `, ${rec.role}` : ''}</p>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
				<div class="cv-connector">
					<hr />
					<img src="/assets/circle.svg" class="cv-circle" alt="" />
				</div>
			</div>
		{/each}
	</div>
</div>
