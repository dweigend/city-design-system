import type { AssetRecipe } from '../definition';
import { deckAwning } from './deck-awning';
import { kitRecipe } from './kit-recipe';
import { panel } from './forms';
import { planted } from '../planted';
import { suggestions } from './suggestions';
const variants = ['short', 'standard', 'long'];
export const terraceFittings: AssetRecipe[] = [
	deckAwning,
	{
		...kitRecipe(
			'kit-terrace-bench',
			'house-fittings',
			[2.5, 1.25],
			['deck', 'frame'],
			variants,
			(v) => {
				const l = 1.4 + v * 0.28;
				return [
					panel(0, 0, 0.26, l, 0.48, 0.19, 'deck'),
					...[-1, 1].map((s) => panel((s * l) / 3, 0, 0, 0.3, 0.4, 0.26, 'frame'))
				];
			}
		),
		suggestions: { deck: suggestions.slats, frame: suggestions.foot }
	},
	{
		...kitRecipe(
			'kit-terrace-planter',
			'house-fittings',
			[2.5, 1.25],
			['body', 'planting'],
			variants,
			(v) => {
				const l = 1.4 + v * 0.28;
				return [
					panel(0, 0, 0, l, 0.54, 0.3, 'body'),
					...[-1, 0, 1].map((s, i) =>
						panel(s * l * 0.28, 0, 0.3, l * 0.33, 0.48, [0.44, 0.65, 0.32][i], 'planting')
					)
				];
			}
		),
		suggestions: { body: suggestions.foot, planting: planted.finishes.sedum }
	},
	{
		...kitRecipe(
			'kit-terrace-paving',
			'house-fittings',
			[2.5, 1.25],
			['body'],
			['fine-terrazzo', 'fine-run', 'fine-landing'],
			(v) => [panel(0, 0, 0, [1.25, 2.5, 2.5][v], [1.25, 0.62, 1.25][v], 0.12, 'body')]
		),
		suggestions: { body: suggestions.foot }
	}
];
