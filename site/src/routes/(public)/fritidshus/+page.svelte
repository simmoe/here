<script lang="ts">
	import { onMount } from 'svelte';
	import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
	import { getDb } from '$lib/firebase/client';

	type House = {
		id: string;
		address?: string;
		area?: string;
		priceDkk: number;
		minutes: number;
		driveFrom: string;
		water: string;
		evidence: string;
		url?: string;
		photo?: string;
	};

	type Report = {
		ranAt?: string;
		done?: boolean;
		error?: string;
		counts?: { withWater?: number; withinDrive?: number };
		houses: House[];
	};

	const noteId = /^fastighetsbyran:\d+$/;

	let searched = $state('');
	let status = $state('');
	let houses = $state<House[]>([]);
	let notes = $state<Record<string, string>>({});
	let shownKey = '';
	const noteTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function dkk(value: number) {
		return value.toLocaleString('da-DK') + ' kr';
	}

	function httpsOnly(value: unknown) {
		return typeof value === 'string' && value.startsWith('https://') ? value : '';
	}

	function searchedAt(iso: string | undefined) {
		if (!iso) return '';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		const formatted = new Intl.DateTimeFormat('da-DK', {
			timeZone: 'Europe/Copenhagen',
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
		return 'Sidste søgning ' + formatted + '.';
	}

	function show(report: Report | null | undefined) {
		if (!report || !report.houses) {
			searched = '';
			status = '';
			return;
		}
		searched = searchedAt(report.ranAt);
		const counts = report.counts || {};
		let tail = (counts.withWater ?? 0) + ' huse med vand, af ' + (counts.withinDrive ?? 0) + ' inden for to timer.';
		if (report.error) tail = report.error + ' ' + tail;
		if (report.done === false) tail = 'Søger. ' + tail;
		status = tail;
		const key = report.houses.map((house) => house.id).join('\n');
		if (key === shownKey) return;
		shownKey = key;
		houses = report.houses;
	}

	function scheduleSave(id: string, value: string) {
		clearTimeout(noteTimers[id]);
		noteTimers[id] = setTimeout(() => {
			if (!noteId.test(id)) return;
			void setDoc(doc(getDb(), 'here_fritidshus_notes', id), {
				text: value.slice(0, 2000),
				updatedAt: serverTimestamp()
			}).catch(() => {});
		}, 400);
	}

	onMount(() => {
		const unsub = onSnapshot(collection(getDb(), 'here_fritidshus_notes'), (snap) => {
			const next: Record<string, string> = {};
			snap.forEach((item) => {
				const text = item.data().text;
				if (typeof text === 'string' && noteId.test(item.id)) next[item.id] = text.slice(0, 2000);
			});
			notes = next;
		});

		const load = () => {
			fetch('/fritidshus/results.json?t=' + Date.now())
				.then((response) => (response.ok ? response.json() : null))
				.then(show)
				.catch(() => {});
		};
		load();
		const timer = setInterval(load, 10000);
		return () => {
			unsub();
			clearInterval(timer);
			for (const id of Object.keys(noteTimers)) clearTimeout(noteTimers[id]);
		};
	});
</script>

<svelte:head>
	<title>Fritidshus</title>
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&family=Raleway:wght@500&display=swap"
	/>
</svelte:head>

<div class="fh">
	<div class="bar">Fritidshus</div>
	<div class="wrap">
		<p class="sources">Søgningen bruger Fastighetsbyrån. Hemnet og Booli er blokeret og kommer ikke med.</p>
		<ul>
			<li>Helt hus: villa, fritidshus eller gård. Ingen lejlighed eller rækkehus.</li>
			<li>Under 2.000.000 kr.</li>
			<li>Under to timers kørsel fra Ejderstedgade 2 eller Toftekærsvej 91, Søborg.</li>
			<li>Teksten skal nævne hav, sø eller å. Først derefter tjekkes de fem første fotos og satellitkortet.</li>
		</ul>
		<p class="searched">{searched}</p>
		<div class="status">{status}</div>
		{#each houses as house (house.id)}
			<div class="house">
				<img src={httpsOnly(house.photo)} alt="" />
				<div>
					<h2>
						{#if httpsOnly(house.url)}
							<a href={httpsOnly(house.url)} target="_blank" rel="noreferrer">{house.address || ''}</a>
						{:else}
							{house.address || ''}
						{/if}
					</h2>
					<p>{house.area || ''}</p>
					<p>{dkk(house.priceDkk)} · {house.minutes} min fra {house.driveFrom}</p>
					<p>{house.water}. {house.evidence}</p>
				</div>
				{#if noteId.test(house.id)}
					<textarea
						class="note"
						placeholder="Kommentar"
						maxlength="2000"
						value={notes[house.id] || ''}
						oninput={(event) => {
							const value = event.currentTarget.value;
							notes = { ...notes, [house.id]: value };
							scheduleSave(house.id, value);
						}}
					></textarea>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style>
	.fh {
		margin: 0;
		background: #f6f4f0;
		color: #1a1a1a;
		font-family: 'Open Sans', sans-serif;
		min-height: 100vh;
	}
	.bar {
		background: #111;
		color: white;
		padding: 1.1rem 8vw;
		font-family: Raleway, sans-serif;
		letter-spacing: 0.04em;
	}
	.wrap {
		width: min(1080px, calc(100% - 3rem));
		margin: 2rem auto 4rem;
	}
	.sources {
		margin: 0 0 1.4rem;
	}
	ul {
		line-height: 1.6;
		padding-left: 1.1rem;
	}
	.searched,
	.status {
		margin: 1rem 0 0;
		color: #444;
	}
	.status {
		margin-bottom: 1.5rem;
	}
	.house {
		display: grid;
		grid-template-columns: 160px 1fr 11rem;
		gap: 1rem;
		background: white;
		padding: 0.8rem;
		margin: 0 0 0.8rem;
	}
	.house img {
		width: 160px;
		height: 120px;
		object-fit: cover;
		background: #ddd;
	}
	.note {
		width: 100%;
		min-height: 120px;
		box-sizing: border-box;
		border: 1px solid #ddd;
		padding: 0.45rem 0.5rem;
		font: inherit;
		font-size: 0.85rem;
		resize: vertical;
		background: #fafafa;
	}
	.house h2 {
		font-family: Raleway, sans-serif;
		font-size: 1.15rem;
		font-weight: 500;
		margin: 0 0 0.3rem;
	}
	.house p {
		margin: 0.15rem 0;
	}
	.house a {
		color: inherit;
	}
	@media (max-width: 640px) {
		.house {
			grid-template-columns: 1fr;
		}
		.house img {
			width: 100%;
			height: 200px;
		}
		.note {
			min-height: 4.5rem;
		}
	}
</style>
