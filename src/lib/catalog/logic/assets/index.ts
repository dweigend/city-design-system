import { hashUnit } from '../../core/random';
import type { Primitive, FinishId, ColorToken, BuildingSurface } from '../parametrik/types';
import { finishMaterial } from '../material/surface';
import { recipes } from './recipes';
import type { AssetPlacement, AssetRecipe, AssetSurface } from './definition';
import { suggestedSurface } from './slot-defaults';

export { assetCategories, type AssetCategory } from './definition';
export { shellElevationPoint } from './full-height-shell';
export type { ObjectGeometry } from './object-geometry';
export type SlotAssignment = {
	token: ColorToken;
	finish: FinishId;
	colourRole?: Primitive['colourRole'];
};
export type ObjectSurface =
	SlotAssignment | { buildingSurface: BuildingSurface; override?: SlotAssignment };
export type ObjectOptions = {
	instanceId?: string;
	slots?: Readonly<Record<string, ObjectSurface>>;
};

type BuildingSlots = Pick<BuildingSurface, 'use' | 'ensemble'> & {
	slots: Readonly<Record<string, BuildingSurface['slot']>>;
};

type SlotDefaults = Readonly<Record<string, Readonly<AssetSurface>>>;
export type AssetDefinition = Omit<AssetPlacement, 'suggestions'> & {
	slotDefaults: Readonly<Record<string, SlotDefaults>>;
};

function describe(recipe: AssetRecipe): AssetDefinition {
	const { id, category, variants, footprint, anchors, slotNames, finishes } = recipe;
	const slotDefaults: Record<string, SlotDefaults> = {};
	for (const variant of variants) {
		const slots = slotNames.map(
			(slot) => [slot, Object.freeze(suggestedSurface(recipe, variant, slot))] as const
		);
		slotDefaults[variant] = Object.freeze(Object.fromEntries(slots));
	}
	return {
		id,
		category,
		variants,
		footprint,
		anchors,
		slotNames,
		finishes,
		slotDefaults: Object.freeze(slotDefaults)
	};
}

const byId = new Map(
	recipes.map((recipe) => [recipe.id, { recipe, definition: describe(recipe) }])
);
if (byId.size !== recipes.length) throw new Error('Duplicate object ID in asset registry');
/** Placement descriptions and suggested surfaces per variant and slot, in contact-sheet order. */
export const assetRegistry: readonly AssetDefinition[] = [...byId.values()].map(
	(entry) => entry.definition
);

/** Builds metre-space geometry and independently dressed primitives for the city and bible. */
export function buildObject(
	id: string,
	variant: string,
	seed: number,
	options: ObjectOptions & { building?: BuildingSlots } = {}
) {
	const entry = byId.get(id);
	if (!entry) throw new RangeError('Unknown asset: ' + id);
	const { recipe, definition } = entry;
	const index = recipe.variants.indexOf(variant);
	if (index < 0) throw new RangeError('Unknown ' + id + ' variant: ' + variant);
	for (const key of Object.keys(options.slots ?? {}))
		if (!recipe.slotNames.includes(key)) throw new RangeError('Unknown slot: ' + id + '/' + key);
	const defaults = definition.slotDefaults[variant];
	const geometry = recipe
		.draw(index, hashUnit(seed, id, variant))
		.map((part, i) => ({ ...part, id: (options.instanceId ?? id) + '/' + i }));
	const parts = geometry.map(({ slot, ...shape }): Primitive => {
		const suggestion = defaults[slot];
		const key =
			slot === 'figure' && recipe.legacyFigureSlot && !options.slots?.figure
				? recipe.legacyFigureSlot
				: slot;
		return { ...shape, ...dressSlot(suggestion, options.slots?.[key], options.building, key) };
	});
	return { geometry, defaults, parts, footprint: recipe.footprint, anchors: recipe.anchors };
}

function defaultBuildingSlot(building: BuildingSlots | undefined, key: string) {
	const slot = building?.slots[key];
	if (building && slot) return { use: building.use, ensemble: building.ensemble, slot };
}

function dressSlot(
	suggestion: AssetSurface,
	assignment: ObjectSurface | undefined,
	building: BuildingSlots | undefined,
	key: string
) {
	const deferred = assignment && 'buildingSurface' in assignment;
	const chosen = deferred ? assignment.override : assignment;

	const buildingSurface = deferred
		? assignment.buildingSurface
		: defaultBuildingSlot(building, key);
	if (buildingSurface && !chosen) {
		return {
			material: suggestion.material,
			buildingSurface
		};
	}
	return {
		...assignedSurface(suggestion, chosen),
		...(deferred && chosen?.finish !== 'city-drawing' && { buildingSurface })
	};
}

function assignedSurface(suggestion: AssetSurface, chosen?: SlotAssignment) {
	const { token, finish } = chosen ?? suggestion;
	return {
		...(chosen?.colourRole && { colourRole: chosen.colourRole }),
		material: finish === suggestion.finish ? suggestion.material : finishMaterial(finish),
		token,
		...(finish === 'city-drawing' ? {} : { finish })
	};
}

/** Compatibility entry point for callers consuming dressed primitives only. */
export function buildAsset(id: string, variant: string, seed: number, instanceId = id) {
	return buildObject(id, variant, seed, { instanceId }).parts;
}

/** Returns the named folded sample's surface for dressing externally owned geometry. */
export function getAssetSurface(id: string, variant: string) {
	const entry = byId.get(id);
	if (!entry?.definition.finishes || !entry.definition.variants.includes(variant))
		throw new RangeError('Unknown surface: ' + id + '/' + variant);
	return { ...entry.definition.finishes[variant] };
}
