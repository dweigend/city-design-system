import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const storyChapter = {
	number: 9.1,
	slug: 'geschichte',
	title: 'Story line',
	summary:
		'A metropolis grows from the first courts in an invented valley, event by event, until you take over in 2030.',
	steps: [
		placeholder(0, {
			label: 'To 2030',
			title: 'From bare ground to 2030',
			caption:
				'One valley, from bare ground to 2030. Every part keeps the year it was built; age is a state, not a class.',
			principles: ['GROW-3'],
			view: 'iso'
		}),
		placeholder(1, {
			label: 'Relief',
			title: 'The river draws the land',
			caption:
				'Ice-age rivers pile up gravel terraces; since then the river wanders across its floodplain. The land is its diary.',
			principles: [],
			view: 'terrain',
			scene: 'valley'
		}),
		placeholder(2, {
			label: 'Hamlets',
			title: 'Hamlets find their place',
			caption:
				'Households pick spots near water but safe from floods. Their footpaths between hamlets become the first lanes of the later town.',
			principles: ['GROW-1'],
			view: 'plan',
			scene: 'valley'
		}),
		placeholder(3, {
			label: 'One center',
			title: 'One place becomes the center',
			caption:
				'Hamlets compete for traffic. Small changes tip the balance, and one place becomes the center all long paths lead to.',
			principles: [],
			view: 'plan'
		}),
		placeholder(4, {
			label: 'The walled town',
			title: 'The walled town fills up',
			caption:
				'Inside the wall the town densifies; at its edge it explores. Every pause leaves a belt of gardens and cloisters.',
			principles: ['CITY-6'],
			view: 'plan'
		}),
		placeholder(5, {
			label: 'Industry',
			title: 'Industry pulls the town outward',
			caption:
				'Rail and harbor pull the town outward. A ring replaces the wall, grid quarters appear, and the river is straightened.',
			principles: ['GRID-3'],
			view: 'iso'
		}),
		placeholder(6, {
			label: 'Expansion',
			title: 'The city spreads and consumes',
			caption:
				'Faster travel stretches the town into satellites and cul-de-sac suburbs, while material use and emissions climb steeply.',
			principles: [],
			view: 'plan'
		}),
		placeholder(7, {
			label: 'Take over',
			title: '2030: you take over',
			caption:
				'The game opens in 2030 on a small seeded town. Its stock can be grayed out, so the new reads first.',
			principles: ['GROW-4'],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
