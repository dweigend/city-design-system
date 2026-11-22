import { hashUnit } from '../../core/random';
import type {
	Primitive,
	FinishId,
	ColorToken,
	BuildingSurface,
	MaterialId,
	Role,
	Vec3
} from '../parametrik/types';
import { finishMaterial } from '../material/surface';
import { recipes } from './recipes';
import type { AssetPlacement, AssetRecipe, AssetSurface, RibbonSegmentSite } from './definition';
import { suggestedSurface } from './slot-defaults';

export { assetCategories, type AssetCategory } from './definition';
export { shellElevationPoint } from './full-height-shell';
export { ribbonDimensions, ribbonPierGeometry } from './ribbon-segment';
export type { ObjectGeometry } from './object-geometry';
export type { RibbonPort, RibbonPorts, RibbonSection, RibbonSegmentSite } from './definition';
export type SlotAssignment = {
	token: ColorToken;
	finish: FinishId;
	colourRole?: Primitive['colourRole'];
};
/** Material-only slot dressing without palette token or finish (e.g. neutral paper sections). */
export type MaterialAssignment = {
	material: MaterialId;
	role?: Role;
};
export type ObjectSurface =
	| SlotAssignment
	| MaterialAssignment
	| { buildingSurface: BuildingSurface; override?: SlotAssignment };
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
	const { id, category, siteParametric, variants, footprint, anchors, slotNames, finishes } =
		recipe;
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
		...(siteParametric && { siteParametric }),
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

/**
 * Builds metre-space geometry and independently dressed primitives for the city and bible.
 * Pass `options.site` for site-parametric definitions (such as `ribbon-segment`) to project
 * caller-surveyed world geometry with derived footprint and anchors while keeping stock
 * definitions unchanged. Throws `RangeError` for unknown assets, variants, slots or sites.
 */
export function buildObject(
	id: string,
	variant: string,
	seed: number,
	options: ObjectOptions & { building?: BuildingSlots; site?: RibbonSegmentSite } = {}
) {
	const entry = byId.get(id);
	if (!entry) throw new RangeError('Unknown asset: ' + id);
	const { recipe, definition } = entry;
	const index = recipe.variants.indexOf(variant);
	if (index < 0) throw new RangeError('Unknown ' + id + ' variant: ' + variant);
	for (const key of Object.keys(options.slots ?? {}))
		if (!recipe.slotNames.includes(key)) throw new RangeError('Unknown slot: ' + id + '/' + key);
	const defaults = definition.slotDefaults[variant];
	const sample = hashUnit(seed, id, variant);
	const built = options.site
		? buildSite(recipe, id, index, sample, options.site, options.instanceId ?? id)
		: {
				geometry: recipe
					.draw(index, sample)
					.map((part, i) => ({ ...part, id: (options.instanceId ?? id) + '/' + i })),
				footprint: recipe.footprint,
				anchors: recipe.anchors
			};
	const geometry = built.geometry.map((part) => structuredClone(part));
	const parts = geometry.map(({ slot, ...shape }): Primitive => {
		const suggestion = defaults[slot];
		const key =
			slot === 'figure' && recipe.legacyFigureSlot && !options.slots?.figure
				? recipe.legacyFigureSlot
				: slot;
		return {
			...structuredClone(shape),
			...dressSlot(suggestion, options.slots?.[key], options.building, key)
		};
	});
	const footprint: readonly [number, number] = [built.footprint[0], built.footprint[1]];
	const anchors = built.anchors.map((a) => ({
		attachment: a.attachment,
		position: [...a.position] as Vec3,
		normal: [...a.normal] as Vec3
	}));
	return {
		geometry,
		defaults,
		parts,
		footprint,
		anchors
	};
}

function buildSite(
	recipe: AssetRecipe,
	id: string,
	index: number,
	sample: number,
	site: RibbonSegmentSite,
	instanceId: string
) {
	if (!recipe.drawSite) throw new RangeError('Asset does not accept a site: ' + id);
	return recipe.drawSite(index, sample, site, instanceId);
}

function defaultBuildingSlot(building: BuildingSlots | undefined, key: string) {
	const slot = building?.slots[key];
	if (building && slot) return { use: building.use, ensemble: building.ensemble, slot };
}

function isMaterialOnly(assignment: ObjectSurface | undefined): assignment is MaterialAssignment {
	return Boolean(assignment && 'material' in assignment && !('finish' in assignment));
}

function dressSlot(
	suggestion: AssetSurface,
	assignment: ObjectSurface | undefined,
	building: BuildingSlots | undefined,
	key: string
) {
	if (isMaterialOnly(assignment)) {
		return {
			material: assignment.material,
			...(assignment.role && { role: assignment.role })
		};
	}
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
