import type { Uebertragung } from './uebertragung';

/** Reference images for the UI design language, stored under static/references/. */
export type Reference = Partial<Uebertragung> & {
	id?: string;
	file: string;
	title: string;
	eigen?: boolean;
};

export const references: Reference[] = [
	{
		id: '03',
		eigen: true,
		file: 'uebertragung-03-kreuzraster.webp',
		vorbild: '',
		zweck: 'UI layout: a grid of cross marks on which images sit freely as a collage → Grid',
		zentrum: 'UI-Layout',
		title: 'Cross-mark grid'
	},
	{
		id: '09',
		eigen: true,
		file: 'uebertragung-09-kennzahlen.webp',
		vorbild: '',
		zweck:
			'UI layout: a quiet card with a large number and a scale ruler → Interface (metric, slider)',
		zentrum: 'UI-Layout',
		title: 'Metrics'
	},
	{
		id: '19',
		eigen: true,
		file: 'uebertragung-19-baustein-icons.webp',
		vorbild: '',
		zweck:
			'UI layout: isometric icons, one color per category, as a matrix → Icons, Interface (building catalog)',
		zentrum: 'UI-Layout',
		title: 'Building-block icons'
	},
	{ file: '20-city-matrix-hud.webp', title: 'City Matrix', eigen: true },
	{ file: '21-metabolic-metropolis.webp', title: 'Metabolic Metropolis', eigen: true },
	{ file: '22-isometrie-stadt-aquarell.webp', title: 'Watercolor city', eigen: true }
];
