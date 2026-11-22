import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const supplyChapter = {
	number: 4,
	slug: 'versorgung',
	title: 'Supply',
	summary: 'Water, energy, food and material circulate through built parts in the district.',
	steps: [
		placeholder(0, {
			label: 'Four loops',
			title: 'Four loops in one district',
			caption:
				'Water, energy, food and material run through the district in loops. You can follow each one through built parts.',
			principles: [],
			view: 'plan'
		}),
		placeholder(1, {
			label: 'Rain',
			title: 'Rain stays in the district',
			caption:
				'A 30 mm storm on one court fills the tank, then the swale. The sponge is built and visible, not a hidden number.',
			principles: ['CITY-10'],
			view: 'iso'
		}),
		placeholder(2, {
			label: 'Flows',
			title: 'Every flow closes a loop',
			caption:
				'Each flow runs from source to store to use and back. Pick a flow to see where its loop closes and what one person needs.',
			principles: [],
			view: 'plan'
		}),
		placeholder(3, {
			label: 'Pipes and cables',
			title: 'Pipes and cables run in sight',
			caption:
				'Pipes and cables run along the frame in plain sight. Move the cut to follow them from roof to ground.',
			principles: [],
			view: 'iso'
		}),
		placeholder(4, {
			label: 'Passports',
			title: 'Nothing is lost',
			caption:
				'Every part carries a passport. Take a house down: its parts go to the exchange and come back in the next one.',
			principles: [],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
