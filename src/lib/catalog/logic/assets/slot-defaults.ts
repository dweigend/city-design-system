import type { ColorToken } from '../parametrik/types';
import type { AssetRecipe, AssetSurface } from './definition';

const pigments: Record<string, ColorToken> = {
	body: '--paper',
	plaza: '--cat-business-2',
	accent: '--body-living',
	glass: '--cat-health-3',
	channel: '--cat-health',
	highlight: '--cat-mobility',
	planting: '--cat-nature',
	trim: '--cat-living',
	deck: '--cat-business',
	edge: '--ink',
	frame: '--blueprint',
	basin: '--cat-health-3',
	funnel: '--cat-health'
};

const physicalDefaults: Record<string, Pick<AssetSurface, 'material' | 'finish'>> = {
	frame: { material: 'metal', finish: 'metall-lackiert' },
	glass: { material: 'glass', finish: 'clear-acrylic' },
	deck: { material: 'wood', finish: 'holz-natur' },
	plaza: { material: 'concrete', finish: 'beton-terrazzo' }
};

/** Resolves a recipe's authored slot suggestion, with physical defaults for unassigned bodies. */
export function suggestedSurface(recipe: AssetRecipe, variant: string, slot: string): AssetSurface {
	const preset = recipe.finishes?.[variant] ?? recipe.suggestions?.[slot];
	if (preset) return { ...preset };
	const token = pigments[slot];
	if (!token) throw new RangeError('Missing slot suggestion: ' + recipe.id + '/' + slot);
	if (recipe.category === 'ceramics' || slot === 'basin' || slot === 'funnel')
		return { token, material: 'glaze', finish: 'keramik-glasiert' };
	return {
		token,
		...(physicalDefaults[slot] ?? { material: 'acrylic', finish: 'kunststoff-formteil' })
	};
}
