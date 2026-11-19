import { plate } from './assembly';
import { mount, type AssetRecipe } from './definition';
import { rod, surface } from './parts';

const stock = {
	category: 'access',
	footprint: [1, 1],
	variants: ['standard'],
	anchors: [mount('deck')]
} as const;
export const circulationObjects: AssetRecipe[] = [
	{
		...stock,
		id: 'landing',
		variants: ['standard', 'mast-platform'],
		slotNames: ['deck'],
		draw: (variant) => [
			plate(
				[
					[-0.5, -0.5],
					[0.5, -0.5],
					[0.5, 0.5],
					[-0.5, 0.5]
				],
				0,
				variant === 1 ? 0.035 : 0.12,
				'deck'
			)
		]
	},
	{
		...stock,
		id: 'ramp',
		slotNames: ['deck'],
		draw: () => [
			{ ...surface('deck'), kind: 'wedge', position: [-0.5, -0.5, 0], size: [1, 1, 1], low: 0 }
		]
	},
	{
		...stock,
		id: 'railing',
		slotNames: ['frame'],
		draw: () => [
			rod([0, 0, 0.92], [1, 0, 0.92], 0.035, 'frame'),
			rod([0, 0, 0], [0, 0, 0.92], 0.028, 'frame'),
			rod([1, 0, 0], [1, 0, 0.92], 0.028, 'frame')
		]
	}
];
