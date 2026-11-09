export type SkillCard = {
	id: string;
	title: string;
	description: string;
};

/** Cards for personal skills. The procedure itself lives in ~/.cursor/skills. */
export const skills: SkillCard[] = [
	{
		id: 'aftaler',
		title: 'Aftaler',
		description:
			'Finder en dag, der er fri i både arbejdskalenderen og den private kalender, booker tiden og lægger den i den private kalender.'
	},
	{
		id: 'dagsnoter',
		title: 'Dagsnoter',
		description:
			'Folder en begivenhed ud på I dag, henter sted og dagsorden fra mailen, og skriver noter ud fra de billeder, der er bekræftet.'
	}
];
