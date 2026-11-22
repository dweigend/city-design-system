import { placeholder } from './placeholder';
import type { Chapter } from './types';
import { VALLEY_PICTURE_SEEDS } from '../valley-references';
import { viewModes } from '../view-modes';

const preset = { scene: 'valley', seed: VALLEY_PICTURE_SEEDS[0] } as const;

/** Chapter 1, using the same seeded field as the valley study. */
export const landscapeChapter = {
	number: 1,
	slug: 'landschaft',
	title: 'Landscape and typography',
	summary:
		'A river shapes an invented valley, everything that follows rests on it, and one typeface labels it.',
	steps: [
		{
			id: 'step-0',
			title: 'A valley comes first',
			principles: ['UI-3'],
			view: 'terrain',
			views: viewModes,
			display: 'normal',
			preset,
			control: {
				kind: 'playback',
				hint: 'Press Play to reveal the river, terraces and contours.',
				cues: [
					{ atMs: 0, phase: 0, view: 'terrain' },
					{ atMs: 650, phase: 1 },
					{ atMs: 1350, phase: 2 },
					{ atMs: 2200, phase: 2, view: 'iso' }
				]
			},
			caption:
				'A river valley forms from one seed. Everything later in this bible is built on this ground.',
			details: {
				label: 'How the valley is revealed',
				text: 'The lead demo first shows the relief, then colors the wet channel and terraces, then draws contours. Each layer uses the same sampled valley.'
			}
		},
		{
			id: 'step-1',
			title: 'An invented valley',
			principles: ['CITY-11'],
			view: 'terrain',
			views: ['terrain'],
			display: 'normal',
			preset,
			control: {
				kind: 'seed',
				seeds: VALLEY_PICTURE_SEEDS,
				hint: 'Reroll to walk through the three study seeds.'
			},
			caption:
				'Every valley is invented from a seed, never copied from a real city. Reroll it: a new river, the same order.',
			details: {
				label: 'How the valley is computed and how we test it',
				text: 'The valley generator lays out a river course and samples the bed, water level and terraces on a two-kilometer square. Tests measure channel width, sinuosity and relief across seeds.'
			}
		},
		{
			id: 'step-2',
			title: 'One valley, five views',
			principles: ['LIB-8'],
			view: 'terrain',
			views: viewModes,
			display: 'normal',
			preset,
			control: { kind: 'view', hint: 'Choose a view in the stage.' },
			caption:
				'Iso, plan, schematic, section and terrain are camera modes of one scene. No picture in this bible is drawn separately.',
			details: {
				label: 'How the views frame the valley',
				text: 'Iso turns the valley to an oblique angle. Plan looks straight down. Terrain faces downstream to show the profile of the banks.'
			}
		},
		placeholder(3, {
			label: 'Interventions',
			title: 'Terrain changes only by building',
			caption:
				'The ground moves only where a visible structure moves it: a terrace, a cut, a dam. The grid follows.',
			principles: ['GRID-3'],
			view: 'terrain',
			scene: 'valley'
		}),
		placeholder(4, {
			label: 'Typography',
			title: 'One typeface labels everything',
			caption:
				'One typeface, one size scale: the same letters label this page, the map and the game.',
			principles: [],
			view: 'plan',
			scene: 'valley'
		})
	]
} as const satisfies Chapter;
