import { placeholder } from './placeholder';
import type { Chapter } from './types';

export const architectureChapter = {
	number: 5,
	slug: 'architektur',
	title: 'Architecture',
	summary:
		'Seventeen methods shape occupied and open cells into connected structures that fit the land.',
	steps: [
		placeholder(0, {
			label: 'Plot and house',
			title: 'One plot, one house',
			caption:
				'One plot, one house, built step by step: cells, volume, frame, joints. Every step is a state of the same model.',
			principles: [],
			view: 'iso'
		}),
		placeholder(1, {
			label: 'Solid and void',
			title: 'Solid and void, on any cell',
			caption:
				'A house is cells kept and cells left open in one 3D grid. The same rule fits square, corner and distorted cells.',
			principles: ['FORM-1', 'FORM-9'],
			view: 'iso'
		}),
		placeholder(2, {
			label: 'Methods',
			title: 'Seventeen methods, one plot',
			caption:
				'Seventeen methods work on the same plot, from grammar to fibre winding. Each must end as a sculpture, not a box.',
			principles: ['FORM-2'],
			view: 'iso'
		}),
		placeholder(3, {
			label: 'Inputs',
			title: 'Height, width, complexity: one set of inputs',
			caption:
				'Every method takes the same inputs: height, width and complexity. Turn complexity up and calm volumes become lively ones.',
			principles: ['LIB-3'],
			view: 'iso'
		}),
		placeholder(4, {
			label: 'Ensembles',
			title: 'Ensembles, not rows',
			caption:
				'One to three masses join into an ensemble with bridges between them. Rows of blocks never form.',
			principles: ['FORM-4'],
			view: 'iso'
		}),
		placeholder(5, {
			label: 'Force',
			title: 'Stroke width is force',
			caption:
				'The main frame is drawn strong, secondary members as hairlines. It must look built; it need not be statically correct.',
			principles: ['FORM-6', 'CITY-8'],
			view: 'iso'
		}),
		placeholder(6, {
			label: 'Joints',
			title: 'Everything is joined',
			caption:
				'Pull the house apart: a collar, node or flange sits at every contact. Ladders hang on the frame and never carry it.',
			principles: ['FORM-5', 'FORM-7'],
			view: 'iso'
		}),
		placeholder(7, {
			label: 'Slope',
			title: 'Nestled into the land',
			caption:
				'On a steeper slope the house steps down the hill. It never stands on a tray on stilts.',
			principles: ['FORM-8'],
			view: 'terrain'
		}),
		placeholder(8, {
			label: 'Phases',
			title: 'Three construction phases',
			caption:
				'New building follows Memphis, then Archigram and Fuller, then organic forms. Each earlier phase remains as stock.',
			principles: ['FORM-10'],
			view: 'iso'
		})
	]
} as const satisfies Chapter;
