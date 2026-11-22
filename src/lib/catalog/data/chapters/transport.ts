import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const transportChapter = {
	number: 3,
	slug: 'wege',
	title: 'Paths and transport',
	summary:
		'People walk on lanes and ribbons, trains run above them, and one graph finds every route.',
	steps: [
		placeholder(0, {
			label: 'Car-free town',
			title: 'A town without cars',
			caption:
				'No cars, no roads. People walk on lanes and ribbons, trains run above the stock, and one graph carries them all.',
			principles: [],
			view: 'iso'
		}),
		placeholder(1, {
			label: 'Public ways',
			title: 'Five kinds of way replace the road',
			caption:
				'Promenade, main lane, lane, stair lane, square: five kinds of public way replace the road. A brief never says street.',
			principles: ['CITY-2'],
			view: 'plan'
		}),
		placeholder(2, {
			label: 'Route graph',
			title: 'One graph finds every route',
			caption:
				'Every way is an edge with length, slope and capacity. Pick two points: the graph finds the route and cuts a passage if needed.',
			principles: ['CITY-4'],
			view: 'plan'
		}),
		placeholder(3, {
			label: 'Wayfinding',
			title: 'People walk toward the goal',
			caption:
				'People do not take the shortest way; they keep pointing at the goal. Switch models and watch the walkers drift apart.',
			principles: [],
			view: 'plan'
		}),
		placeholder(4, {
			label: 'Ribbons',
			title: 'A path is one thin ribbon',
			caption:
				'A path is a ribbon with smooth curvature on slender round columns. Drag its end: it bends and never breaks into parts.',
			principles: ['CITY-5'],
			view: 'iso'
		}),
		placeholder(5, {
			label: 'Rail',
			title: 'Rail runs above the stock',
			caption:
				'Rail and capsule lines run on single pillars above the stock. At each stop they dock onto the walkways.',
			principles: [],
			view: 'iso'
		}),
		placeholder(6, {
			label: 'Movement',
			title: 'The city moves',
			caption:
				'Within ten seconds you see three motions: something waves, something flows along a path, something works.',
			principles: ['CITY-9'],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
