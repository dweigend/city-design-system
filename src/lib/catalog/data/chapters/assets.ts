import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const assetsChapter = {
	number: 8,
	slug: 'bausteine',
	title: '3D assets and building blocks',
	summary:
		'Objects use role slots and meters, and each engine building block is documented with a live example.',
	steps: [
		placeholder(0, {
			label: 'Catalogue',
			title: 'One catalogue',
			caption:
				'Every object in the city comes from one catalogue. Pick a group, then drop an object into the district.',
			principles: [],
			view: 'iso'
		}),
		placeholder(1, {
			label: 'Object contract',
			title: 'One object contract',
			caption:
				'Every object has role slots, a footprint and anchors in meters. That is why it docks on any facade, roof or deck.',
			principles: ['LIB-2'],
			view: 'plan'
		}),
		placeholder(2, {
			label: 'Role slots',
			title: 'Objects carry no color',
			caption:
				'Objects deliver roles like frame, glazing or cloth. The engine colors them, so one object fits every palette and focus.',
			principles: ['MAT-1'],
			view: 'iso'
		}),
		placeholder(3, {
			label: 'Scale figures',
			title: 'People are scale figures',
			caption: 'People are tiny neutral figures without faces. They give scale, not color clutter.',
			principles: ['FORM-11'],
			view: 'iso'
		}),
		placeholder(4, {
			label: 'Silhouette',
			title: 'Same silhouette at every distance',
			caption:
				'Up close an object gains detail; from afar it keeps the same silhouette. Fine structure stays an ink line.',
			principles: [],
			view: 'iso'
		}),
		placeholder(5, {
			label: 'Quality',
			title: 'Two quality levels',
			caption:
				'A full level for strong graphics and a light level for phones show the same scene in one design language.',
			principles: ['MAT-5'],
			view: 'iso'
		}),
		placeholder(6, {
			label: 'Parameters',
			title: 'Parameters, not constants',
			caption:
				'Style, size and recipe are parameters with defaults. Change one and the object rebuilds; nothing is hard-coded.',
			principles: ['LIB-3'],
			view: 'iso'
		}),
		placeholder(7, {
			label: 'Shared library',
			title: 'One library for bible and game',
			caption:
				'The bible and the game run the same engine. The game only adds controls and actions.',
			principles: ['LIB-1'],
			view: 'iso'
		}),
		placeholder(8, {
			label: 'Core types',
			title: 'Six core types at the bottom',
			caption:
				'Six core types sit at the bottom: cells, occupancy, members, surfaces, curves, fields. Every method block builds on them, never sideways.',
			principles: ['LIB-4'],
			view: 'iso'
		}),
		placeholder(9, {
			label: 'Building blocks',
			title: 'A kit with its own documentation',
			caption:
				'Each block has one public entry, documented parameters and a live example. Every demo in this bible is built from them.',
			principles: ['LIB-7'],
			view: 'iso'
		}),
		placeholder(10, {
			label: 'Workers',
			title: 'Heavy work never blocks',
			caption:
				'Everything renders with WebGPU. Heavy steps run in a worker with a budget; a late, stale result never overwrites a newer choice.',
			principles: ['LIB-5', 'LIB-6'],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
