import { hashUnit } from '../../core/random';
import { recipes } from './recipes';
import type { AssetDefinition } from './definition';

export {
	assetCategories,
	type AssetCategory,
	type AssetDefinition,
	type AssetAnchor,
	type Attachment
} from './definition';
/** Ordered descriptions for placement tools and the contact sheet. Dimensions are metres. */
export const assetRegistry: readonly AssetDefinition[] = recipes.map(
	({ draw: _draw, ...entry }) => entry
);

/** Builds detached local primitives for a named variant. Seed is read as u32.
 * Supply a unique instanceId when composing multiple instances into one structure batch. */
export function buildAsset(id: string, variant: string, seed: number, instanceId = id) {
	const recipe = recipes.find((entry) => entry.id === id);
	if (!recipe) throw new RangeError('Unknown asset: ' + id);
	const index = recipe.variants.indexOf(variant);
	if (index < 0) throw new RangeError('Unknown ' + id + ' variant: ' + variant);
	return recipe
		.draw(index, hashUnit(seed, id, variant))
		.map((part, i) => ({ ...part, id: instanceId + '/' + i }));
}
