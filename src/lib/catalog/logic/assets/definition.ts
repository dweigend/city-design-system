import type { Primitive, Vec3, FinishId, ColorToken, MaterialId } from '../parametrik/types';

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
	'structure'
] as const;
export type AssetCategory = (typeof assetCategories)[number];
export type Attachment = 'facade' | 'roof' | 'deck';
export type AssetAnchor = { attachment: Attachment; position: Vec3; normal: Vec3 };
export type AssetSurface = { finish: FinishId; token: ColorToken; material: MaterialId };

export type AssetDefinition = {
	finishes?: Readonly<Record<string, AssetSurface>>;
	id: string;
	category: AssetCategory;
	variants: readonly string[];
	/** Reserved plan dimensions [x, y] in metres, shared by all variants and seeds. */
	footprint: readonly [number, number];
	anchors: readonly AssetAnchor[];
};
export type AssetRecipe = AssetDefinition & {
	draw: (variant: number, sample: number) => Primitive[];
};

/** Describes a local origin on a host plane. Its normal points away from the host. */
export function mount(attachment: Attachment): AssetAnchor {
	return {
		attachment,
		position: [0, 0, 0],
		normal: attachment === 'facade' ? [1, 0, 0] : [0, 0, 1]
	};
}
