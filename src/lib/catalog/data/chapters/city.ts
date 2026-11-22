import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const cityChapter = {
	number: 2,
	slug: 'stadtbau',
	title: 'City',
	summary:
		'The city grows from its terrain. Grid, volume and events give it order without a master plan.',
	steps: [
		placeholder(0, {
			label: 'Town',
			title: 'A town grows on the valley',
			caption:
				'The town grows on the valley in schematic volumes. Grid, volume and events order it; nobody draws a master plan.',
			principles: [],
			view: 'plan'
		}),
		placeholder(1, {
			label: 'Quads',
			title: 'Every ground ends in quads',
			caption:
				'Any polygon splits into quads through its center and edge midpoints. So every rule works on any ground, not only on squares.',
			principles: ['GRID-1', 'GRID-5', 'GRID-4'],
			view: 'plan'
		}),
		placeholder(2, {
			label: 'Envelope',
			title: 'The grid rises into a 3D envelope',
			caption:
				'Ground lines follow the contours; cells above them bound volume, overhang and access. Single bridges may leave the grid.',
			principles: ['GRID-2'],
			view: 'iso'
		}),
		placeholder(3, {
			label: 'Spanned space',
			title: 'Every cell is a spanned space',
			caption:
				'The 3D city grid makes spaces between its nodes. Each spanned space stays empty, carries a bridge or holds a house.',
			principles: ['GRID-7'],
			view: 'iso'
		}),
		placeholder(4, {
			label: 'City seed',
			title: 'One seed, one city volume',
			caption:
				'Terrain, plan, 3D grid and subgrids follow from one seed. Reroll it: a new town, the same order.',
			principles: ['GRID-6'],
			view: 'iso'
		}),
		placeholder(5, {
			label: 'Growth events',
			title: 'Events grow the town, not a plan',
			caption:
				'The town grows through events: a flood, a station, newcomers, a pause. Paths come first, blocks fill in after.',
			principles: ['GROW-1'],
			view: 'plan'
		}),
		placeholder(6, {
			label: 'Built stock',
			title: 'What is built stays',
			caption:
				'Each step keeps the stock standing. New work converts, extends or densifies it and connects to what is there.',
			principles: ['CITY-3', 'GROW-2'],
			view: 'iso'
		}),
		placeholder(7, {
			label: 'Centers',
			title: 'Several centers, no checkerboard',
			caption:
				'Grown towns have over 70 % T-junctions and mixed directions; grid plans mostly crossings. The counters show which one you built.',
			principles: ['CITY-6'],
			view: 'plan'
		}),
		placeholder(8, {
			label: 'Structure',
			title: 'Structure orders space',
			caption:
				'The structural frame sets edges and encloses squares, also between houses. Switch it off and the spaces lose their edges.',
			principles: ['CITY-7'],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
