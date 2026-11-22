import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const surfacesChapter = {
	number: 6,
	slug: 'oberflaechen',
	title: 'Color and surfaces',
	summary:
		'The city has a curated palette. Transparency colors infrastructure by use, while existing buildings read as light volumes or pencil.',
	steps: [
		placeholder(0, {
			label: 'Palette',
			title: 'One district, one palette',
			caption:
				'The same district in one curated palette. Switch to transparency and use colors mark the flows beneath.',
			principles: [],
			view: 'iso'
		}),
		placeholder(1, {
			label: 'Transparency',
			title: 'Transparency mode shows infrastructure',
			caption:
				'Switch to transparency: houses turn gray and see-through, and pipes, cables, paths and flows stand out in color.',
			principles: ['COLOR-8'],
			view: 'iso'
		}),
		placeholder(2, {
			label: 'Five flows',
			title: 'Five flows, one palette',
			caption:
				'Use colors belong to the five flows: people, water, energy, food, material. People and paths are pink; no house ever is.',
			principles: ['COLOR-1', 'COLOR-2', 'COLOR-3'],
			view: 'iso'
		}),
		placeholder(3, {
			label: 'Free color',
			title: 'Free colors, curated palette',
			caption:
				'In the normal view color is free but curated: strong colors and patterns on whole bodies, glaze or terrazzo on every form.',
			principles: ['COLOR-4', 'MAT-3'],
			view: 'iso'
		}),
		placeholder(4, {
			label: 'References',
			title: 'References guide the finish',
			caption:
				'The grid sets the form. A house reference only changes surface, grille, scaffold and light.',
			principles: ['FORM-3'],
			view: 'iso'
		}),
		placeholder(5, {
			label: 'Stock',
			title: 'Stock: volume and pencil',
			caption:
				'Stock carries no use color. Some houses are plain light volumes, others pencil drawings; the mix keeps detail low and life high.',
			principles: ['COLOR-5'],
			view: 'iso'
		}),
		placeholder(6, {
			label: 'Print',
			title: 'Printed, not transparent',
			caption:
				'Overlaps print a third, darker field with a hard edge. Shadows are dots, outlines fine, the structure darkest.',
			principles: ['MAT-2', 'MAT-4'],
			view: 'iso'
		}),
		placeholder(7, {
			label: 'Focus',
			title: 'One focus switches the city',
			caption:
				'Every system offers the same five levels, so one focus switches the city. Only the force analysis uses color without use.',
			principles: ['COLOR-6', 'COLOR-7'],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
