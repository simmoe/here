<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { categoryTitle, filterCv, years } from '$lib/print-cv';
	import { publicData, type Recommendation } from '$lib/public.svelte';

	const id = $derived(page.url.searchParams.get('id') || '');
	const type = $derived(page.url.searchParams.get('type') || 'full');
	const app = $derived(publicData.applications.find((item) => item.id === id));

	const jobs = $derived(app ? filterCv(publicData.cv.entries, app.cvConfig) : []);
	const grouped = $derived.by(() => {
		const order = app?.cvConfig?.categoryOrder || ['job', 'education', 'board'];
		return order
			.map((category) => ({ category, title: categoryTitle(category), jobs: jobs.filter((job) => job.category === category) }))
			.filter((group) => group.jobs.length);
	});

	const recommendations = $derived.by(() => {
		if (!app?.recommendationsConfig?.include) return [];
		let list = publicData.recommendations.slice();
		const excluded = app.recommendationsConfig.excludeIds || [];
		if (excluded.length) list = list.filter((rec) => !excluded.includes(rec.id));
		const excludedCv = app.cvConfig?.excludeIds || [];
		if (excludedCv.length) {
			list = list.filter((rec) => !rec.cvRefs?.length || !rec.cvRefs.every((ref) => excludedCv.includes(ref)));
		}
		const seen = new Set<string>();
		return list.filter((rec) => {
			if (seen.has(rec.author)) return false;
			seen.add(rec.author);
			return true;
		});
	});

	function quote(rec: Recommendation) {
		return app?.recommendationsConfig?.useShortVersion && rec.short ? rec.short : rec.quote;
	}

	onMount(() => {
		const timer = setTimeout(() => window.print(), 600);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>
		{type === 'cv' ? 'CV Simon Moe' : type === 'recommendations' ? 'Anbefalinger Simon Moe' : app?.title || 'Ansøgning Simon Moe'}
	</title>
</svelte:head>

{#if publicData.loaded && app}
	<article class="application-document">
		{#if type === 'full' || type === 'letter'}
			<header class="doc-header">
				<div class="sender-info">
					<h3 class="sender-name">{publicData.contact.name}</h3>
					<p class="sender-phone">{publicData.contact.phone}</p>
				</div>
				<div class="recipient-info">
					<p>{app.recipient?.company}</p>
					<p>{app.recipient?.attn}</p>
					<p>{app.recipient?.address}</p>
					<p>{app.recipient?.zip}</p>
				</div>
			</header>
			<main class="letter-content">
				<p class="letter-meta date">{app.date}</p>
				<h1 class="letter-title">{app.title}</h1>
				<div class="letter-body">
					{#each (app.content || []).filter((line) => line !== '---') as paragraph}
						<p>{paragraph}</p>
					{/each}
					{#if app.useSignature && publicData.contact.signature}
						<img class="signature-img" src={publicData.contact.signature} alt="" />
					{/if}
				</div>
			</main>
		{/if}

		{#if (type === 'full' || type === 'cv') && app.cvConfig?.include}
			<section class="cv-section" style:page-break-before={type === 'cv' ? 'auto' : 'always'} style:margin-top={type === 'cv' ? '0' : undefined}>
				<h1 class="letter-title">CV Simon Moe</h1>
				<div class="print-cv-container">
					{#if publicData.cv.resume && !app.cvConfig.skipResume}
						<div class="print-cv-resume">{@html publicData.cv.resume}</div>
					{/if}
					{#if app.cvConfig.groupByCategory}
						{#each grouped as group}
							<h2 class="print-cv-category-header">{group.title}</h2>
							{#each group.jobs as job}
								<div class="print-cv-item {job.category ? 'print-cat-' + job.category : ''}">
									<div class="print-cv-year">{years(job)}</div>
									<h3 class="print-cv-title">{job.title}</h3>
									<p class="print-cv-place">{job.place}</p>
									{#if job.description}<p class="print-cv-description">{@html job.description}</p>{/if}
									{#if job.image}<img class="print-cv-image" src={job.image} alt="" />{/if}
								</div>
							{/each}
						{/each}
					{:else}
						{#each jobs as job}
							<div class="print-cv-item">
								<div class="print-cv-year">{years(job)}</div>
								<h3 class="print-cv-title">{job.title}</h3>
								<p class="print-cv-place">{job.place}</p>
								{#if job.description}<p class="print-cv-description">{@html job.description}</p>{/if}
							</div>
						{/each}
					{/if}
				</div>
			</section>
		{/if}

		{#if (type === 'full' || type === 'recommendations') && recommendations.length}
			<section class="recommendations-section" style:display="block" style:page-break-before={type === 'recommendations' ? 'auto' : undefined} style:margin-top={type === 'recommendations' ? '0' : undefined}>
				<h1 class="letter-title">Anbefalinger</h1>
				{#each recommendations as rec}
					<div class="recommendation-item">
						<p class="recommendation-quote">"{quote(rec)}"</p>
						<div class="recommendation-meta">
							<span class="recommendation-author">{rec.author}</span>
							<span class="recommendation-role">{rec.role}</span>
							<span class="recommendation-source">{rec.institution ? `${rec.institution}, ` : ''}{rec.year}</span>
						</div>
					</div>
				{/each}
			</section>
		{/if}
	</article>
{/if}
