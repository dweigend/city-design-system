import { hashUnit } from '../../core/random';
import type { Primitive, FinishId, ColorToken } from '../parametrik/types';
import { finishMaterial } from '../material/surface';
import { recipes } from './recipes';
import type { AssetDefinition } from './definition';
import { suggestedSurface } from './slot-defaults';

export {
	assetCategories,
	type AssetCategory,
	type AssetDefinition,
	type AssetAnchor,
	type AssetSurface,
	type Attachment
} from './definition';
export type { ObjectGeometry } from './object-geometry';
export type SlotAssignment = { token: ColorToken; finish: FinishId };
export type ObjectOptions = {
	instanceId?: string;
	slots?: Readonly<Record<string, SlotAssignment>>;
};

const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
/** Placement descriptions in stable contact-sheet order. */
export const assetRegistry: readonly AssetDefinition[] = recipes.map(
	({ id, category, variants, footprint, anchors, slotNames, suggestions, finishes }) => ({
		id,
		category,
		variants,
		footprint,
		anchors,
		slotNames,
		suggestions,
		finishes
	})
);

/** Builds metre-space geometry and independently dressed primitives for the city and bible. */
export function buildObject(
	id: string,
	variant: string,
	seed: number,
	options: ObjectOptions = {}
) {
	const recipe = byId.get(id);
	if (!recipe) throw new RangeError('Unknown asset: ' + id);
	const index = recipe.variants.indexOf(variant);
	if (index < 0) throw new RangeError('Unknown ' + id + ' variant: ' + variant);
	for (const key of Object.keys(options.slots ?? {}))
		if (!recipe.slotNames.includes(key)) throw new RangeError('Unknown slot: ' + id + '/' + key);
	const defaults = Object.fromEntries(
		recipe.slotNames.map((slot) => [slot, suggestedSurface(recipe, variant, slot)])
	);
	const geometry = recipe
		.draw(index, hashUnit(seed, id, variant))
		.map((part, i) => ({ ...part, id: (options.instanceId ?? id) + '/' + i }));
	const parts = geometry.map(({ slot, ...shape }): Primitive => {
		const suggestion = defaults[slot];
		const chosen = options.slots?.[slot];
		const { token, finish } = chosen ?? suggestion;
		return {
			...shape,
			material: finish === suggestion.finish ? suggestion.material : finishMaterial(finish),
			token,
			...(finish === 'city-drawing' ? {} : { finish })
		};
	});
	return { geometry, defaults, parts, footprint: recipe.footprint, anchors: recipe.anchors };
}

/** Compatibility entry point for callers consuming dressed primitives only. */
export function buildAsset(id: string, variant: string, seed: number, instanceId = id) {
	return buildObject(id, variant, seed, { instanceId }).parts;
}

/** Returns the named folded sample's surface for dressing externally owned geometry. */
export function getAssetSurface(id: string, variant: string) {
	const entry = byId.get(id);
	if (!entry?.finishes || !entry.variants.includes(variant))
		throw new RangeError('Unknown surface: ' + id + '/' + variant);
	return { ...entry.finishes[variant] };
}
