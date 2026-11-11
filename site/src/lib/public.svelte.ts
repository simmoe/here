import snapshot from './data/public-content.json';

export type CvJob = {
	id: string;
	title: string;
	place: string;
	startYear?: string | number;
	endYear?: string | number;
	description?: string;
	detail?: string;
	image?: string;
	category?: string;
	order?: number;
	link?: { url: string; text: string };
};

export type Project = {
	title: string;
	year?: number;
	categories: string[];
	context?: string;
	description?: string;
	links?: string[];
	video?: string;
	images?: string[];
	imageFit?: string;
};

export type Application = {
	id: string;
	title: string;
	date?: string;
	content?: string[];
	recipient?: { company?: string; attn?: string; address?: string; zip?: string };
	useSignature?: boolean;
	cvConfig?: {
		include?: boolean;
		excludeIds?: string[];
		categories?: string[];
		groupByCategory?: boolean;
		categoryOrder?: string[];
		skipResume?: boolean;
		offset?: number;
		limit?: number;
		filterCategory?: string;
	};
	recommendationsConfig?: {
		include?: boolean;
		excludeIds?: string[];
		useShortVersion?: boolean;
	};
};

export type Recommendation = {
	id: string;
	author: string;
	role?: string;
	quote?: string;
	short?: string;
	institution?: string;
	year?: string | number;
	cvRefs?: string[];
};

type PublicSnapshot = {
	sitemeta?: { frontpage?: { heading?: string; tagline?: string; statement?: string } };
	contact?: { name?: string; phone?: string; signature?: string };
	cv?: { resume?: string; resumeShort?: string; entries?: CvJob[] };
	projects?: Project[];
	applications?: Application[];
	recommendations?: Recommendation[];
};

function fromSnapshot(data: PublicSnapshot) {
	return {
		sitemeta: data.sitemeta ?? {},
		contact: data.contact ?? {},
		cv: {
			resume: data.cv?.resume ?? '',
			resumeShort: data.cv?.resumeShort ?? '',
			entries: data.cv?.entries ?? []
		},
		projects: data.projects ?? [],
		applications: data.applications ?? [],
		recommendations: data.recommendations ?? []
	};
}

const seeded = fromSnapshot(snapshot as PublicSnapshot);

class PublicData {
	loaded = $state(true);
	error = $state('');
	sitemeta = $state(seeded.sitemeta);
	contact = $state(seeded.contact);
	cv = $state(seeded.cv);
	projects = $state<Project[]>(seeded.projects);
	applications = $state<Application[]>(seeded.applications);
	recommendations = $state<Recommendation[]>(seeded.recommendations);
	#started = false;

	load() {
		if (this.#started) return;
		this.#started = true;
		void this.#fetch();
	}

	async #fetch() {
		try {
			const [{ collection, doc, getDoc, getDocs }, { getDb }] = await Promise.all([
				import('firebase/firestore'),
				import('./firebase/client')
			]);
			const db = getDb();
			const [metaSnap, contactSnap, cvSnap, projectSnap, appSnap, recSnap] = await Promise.all([
				getDoc(doc(db, 'here_content', 'meta')),
				getDoc(doc(db, 'here_content', 'contact')),
				getDocs(collection(db, 'here_cv')),
				getDocs(collection(db, 'here_projects')),
				getDocs(collection(db, 'here_applications')),
				getDocs(collection(db, 'here_recommendations'))
			]);

			this.sitemeta = metaSnap.exists() ? metaSnap.data() : {};
			this.contact = contactSnap.exists() ? contactSnap.data() : {};

			const entries: CvJob[] = [];
			let resume = '';
			let resumeShort = '';
			cvSnap.forEach((item) => {
				const data = item.data();
				if (item.id === '_resume') {
					resumeShort = data['resume-short'] || '';
					resume = data.resume || '';
					return;
				}
				if (data.title && data.place) entries.push({ id: item.id, ...data } as CvJob);
			});
			entries.sort((a, b) => (a.order || 999) - (b.order || 999));
			this.cv = { resume, resumeShort, entries };

			const projects: Project[] = [];
			projectSnap.forEach((item) => projects.push(item.data() as Project));
			projects.sort((a, b) => (b.year || 0) - (a.year || 0));
			this.projects = projects;

			const applications: Application[] = [];
			appSnap.forEach((item) => {
				const data = item.data() as Application;
				if (data.content && !Array.isArray(data.content)) {
					const raw = data.content as unknown as Record<string, string>;
					data.content = Object.keys(raw)
						.sort((a, b) => Number(a) - Number(b))
						.map((key) => raw[key]);
				}
				applications.push({ ...data, id: data.id || item.id });
			});
			applications.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
			this.applications = applications;

			const recommendations: Recommendation[] = [];
			recSnap.forEach((item) =>
				recommendations.push({ id: item.id, ...(item.data() as Omit<Recommendation, 'id'>) })
			);
			this.recommendations = recommendations;
			this.loaded = true;
			this.error = '';
		} catch (error) {
			console.error(error);
			if (!this.sitemeta?.frontpage) this.error = 'Kunne ikke hente indholdet.';
		}
	}
}

export const publicData = new PublicData();

export const projectCategories = [
	{ id: 'undervisning', title: 'Undervisning' },
	{ id: 'software', title: 'Software' },
	{ id: 'kommunikation', title: 'Kommunikation' },
	{ id: 'kunst', title: 'Kunst' },
	{ id: 'ledelse', title: 'Ledelse' }
];

export const cvCategories = [
	{ id: 'job', title: 'Erhvervserfaring' },
	{ id: 'education', title: 'Uddannelse' },
	{ id: 'board', title: 'Organisation' }
];
