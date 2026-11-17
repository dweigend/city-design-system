import type { Uebertragung } from './uebertragung';

/** Reference images for the UI design language, stored under static/img/. */
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
		file: 'uiref-003-ui-cross-mark-grid.webp',
		vorbild: '',
		zweck: 'UI layout: a grid of cross marks on which images sit freely as a collage → Grid',
		zentrum: 'UI-Layout',
		title: 'Cross-mark grid'
	},
	{
		id: '09',
		eigen: true,
		file: 'uiref-009-ui-metrics.webp',
		vorbild: '',
		zweck:
			'UI layout: a quiet card with a large number and a scale ruler → Interface (metric, slider)',
		zentrum: 'UI-Layout',
		title: 'Metrics'
	},
	{
		id: '19',
		eigen: true,
		file: 'uiref-019-ui-building-block-icons.webp',
		vorbild: '',
		zweck:
			'UI layout: isometric icons, one color per category, as a matrix → Icons, Interface (building catalog)',
		zentrum: 'UI-Layout',
		title: 'Building-block icons'
	},
	{ file: 'uiref-020-ui-city-matrix.webp', title: 'City Matrix', eigen: true },
	{ file: 'uiref-021-ui-metabolic-metropolis.webp', title: 'Metabolic Metropolis', eigen: true },
	{ file: 'uiref-022-ui-watercolor-city.webp', title: 'Watercolor city', eigen: true }
];
