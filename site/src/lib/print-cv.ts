import { cvCategories, type CvJob } from './public.svelte';

export function filterCv(
	entries: CvJob[],
	config: {
		excludeIds?: string[];
		categories?: string[];
		offset?: number;
		limit?: number;
		filterCategory?: string;
	} = {}
) {
	let list = entries.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
	if (config.excludeIds?.length) list = list.filter((job) => !config.excludeIds?.includes(job.id));
	if (config.categories?.length) list = list.filter((job) => job.category && config.categories?.includes(job.category));
	const offset = config.offset || 0;
	const limit = config.limit || list.length;
	list = list.slice(offset, offset + limit);
	if (config.filterCategory && config.filterCategory !== 'all') {
		list = list.filter((job) => job.category === config.filterCategory);
	}
	return list;
}

export function years(job: CvJob) {
	if (job.endYear && job.endYear !== job.startYear) return `${job.startYear} - ${job.endYear}`;
	return String(job.startYear || '');
}

export function categoryTitle(id: string) {
	return cvCategories.find((category) => category.id === id)?.title || id;
}
