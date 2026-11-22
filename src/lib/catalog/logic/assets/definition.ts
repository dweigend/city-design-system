import type { ObjectGeometry } from './object-geometry';
import type { Vec3, FinishId, ColorToken, MaterialId } from '../parametrik/types';

export const assetCategories = [
	'facades',
	'capsules',
	'roofs',
	'planting',
	'landmarks',
	'infrastructure',
	'surfaces',
	'house-bodies',
	'roof-pieces',
	'structure',
	'access',
	'ceramics',
	'street-furniture',
	'playgrounds',
	'gardens',
	'waterworks',
	'neighbourhood-services',
	'house-fittings',
	'primitive-forms',
	'seating',
	'tables',
	'lighting',
	'vessels',
	'display',
	'market-stands',
	'shade',
	'recreation',
	'cycle-furniture',
	'wayfinding',
	'fountains',
	'recycling',
	'public-art',
	'textiles',
	'small-architecture',
	'habitat-pods',
	'transit-crossings',
	'stair-towers',
	'memphis-blocks',
	'water-terraces',
	'roof-groves',
	'market-canopies',
	'folded-lanterns',
	'rooftop-equipment',
	'service-manifolds',
	'public-life',
	'occupied-decks',
	'inhabited-modules',
	'promenade-furniture',
	'planted-terraces',
	'studio-sculptures',
	'scaffold-yards',
	'park-specimens',
	'cycling-life'
] as const;
export type AssetCategory = (typeof assetCategories)[number];
export type Attachment = 'facade' | 'roof' | 'deck';
export type AssetAnchor = { attachment: Attachment; position: Vec3; normal: Vec3 };
export type AssetSurface = { finish: FinishId; token: ColorToken; material: MaterialId };

/** Surveyed transverse ribbon cross-section in world metres (x/y plan, z up). */
export type RibbonSection = {
	readonly centre: Vec3;
	readonly left: Vec3;
	readonly right: Vec3;
};

/** Surveyed terminal port in world metres; heading is outward plan angle in radians CCW from +x. */
export type RibbonPort = {
	readonly id: string;
	readonly position: readonly [number, number, number];
	readonly heading: number;
	readonly width: number;
};

/**
 * Caller-prepared site input for a ribbon-segment instance.
 * Coordinates are world metres with origin `[0, 0, 0]`, x/y ground plane and z up.
 */
export type RibbonSegmentSite = {
	readonly sections: readonly RibbonSection[];
	readonly ground: (x: number, y: number) => number;
	readonly ports?: readonly RibbonPort[];
};

export type SiteBuildResult = {
	geometry: ObjectGeometry[];
	footprint: readonly [number, number];
	anchors: readonly AssetAnchor[];
};

export type AssetPlacement = {
	slotNames: readonly string[];
	suggestions?: Readonly<Record<string, AssetSurface>>;
	finishes?: Readonly<Record<string, AssetSurface>>;
	id: string;
	category: AssetCategory;
	/** True when production instances take a caller-prepared site alongside a stock preview default. */
	siteParametric?: true;
	variants: readonly string[];
	/** Reserved plan dimensions [x, y] in metres, shared by all variants and seeds. */
	footprint: readonly [number, number];
	anchors: readonly AssetAnchor[];
};
export type AssetRecipe = AssetPlacement & {
	/** Saved assignments for this former shared slot also dress figures unless explicitly overridden. */
	legacyFigureSlot?: string;
	draw: (variant: number, sample: number) => ObjectGeometry[];
	drawSite?: (
		variant: number,
		sample: number,
		site: RibbonSegmentSite,
		instanceId: string
	) => SiteBuildResult;
};

/** Describes a local origin on a host plane. Its normal points away from the host. */
export function mount(attachment: Attachment): AssetAnchor {
	return {
		attachment,
		position: [0, 0, 0],
		normal: attachment === 'facade' ? [1, 0, 0] : [0, 0, 1]
	};
}
