import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const interfaceChapter = {
	number: 7,
	slug: 'ui',
	title: 'UI',
	summary:
		'The game and website share one design system with the same type, flat blocks, hairlines and one action per view.',
	steps: [
		placeholder(0, {
			label: 'Shared image',
			title: 'Playing and planning share one image',
			caption:
				'Playing and planning share one image. The HUD sits on the city, not beside it, and never hides what it controls.',
			principles: [],
			view: 'iso'
		}),
		placeholder(1, {
			label: 'Design system',
			title: 'One design system for page and game',
			caption:
				'The bible page and the game HUD use the same blocks, type and hairlines. Switch between them: only the controls change.',
			principles: ['UI-3'],
			view: 'iso'
		}),
		placeholder(2, {
			label: 'HUD',
			title: 'The HUD offers one action',
			caption:
				"Flat blocks, hairlines and the bible's type. Each view offers one action and one color focus.",
			principles: ['UI-1'],
			view: 'iso'
		}),
		placeholder(3, {
			label: 'Graphics',
			title: 'Interface graphics are drawn',
			caption:
				'Panels and icons are pen axonometry with dusty pastel fills. No neon, no glow, no glossy 3D.',
			principles: ['UI-2'],
			view: 'iso'
		}),
		placeholder(4, {
			label: 'Open a building',
			title: 'Every building can be opened',
			caption:
				'Tap a house to open it: outside, X-ray, section, exploded or one floor. The same five modes work on every building.',
			principles: [],
			view: 'iso'
		}),
		placeholder(5, {
			label: 'Connections',
			title: 'Trace a connection to its landing',
			caption:
				'Tap a walkway and follow it to where it lands. Every building has more than one way in.',
			principles: [],
			view: 'iso'
		}),
		placeholder(6, {
			label: 'Focus',
			title: 'One focus control',
			caption:
				'One control switches the whole city: normal, transparent, or a single flow in focus.',
			principles: [],
			view: 'iso'
		}),
		placeholder(7, {
			label: 'Icons',
			title: 'Every icon has a model in the city',
			caption:
				'Every icon is drawn from an object in the city. Tap one and its model lights up in the district.',
			principles: [],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
