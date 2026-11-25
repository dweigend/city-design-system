import { defaults } from '../../config/sandbox-brush';
import type { Vec3 } from '../../lib/core/geometry';
import type { Parcel } from '../../lib/domain/parcels';
import type { createSandboxDocument, SandboxPlacement } from '../../lib/domain/sandbox-document';
import {
	readHouseFeatures,
	type HouseFeatures,
	type HouseStyleName
} from '../../lib/domain/house-court';
import { blockTriangleBudget } from '../../lib/scene/house-projection';
import type { SurfaceLevel } from '../../lib/domain/material';
import { projectSketch } from '../../lib/scene/sketch';
import { createSandboxProjection } from '../../lib/scene/sandbox-projection';
import type { Drawable, ModelTone } from '../../lib/scene/surface';
import { groveLawnLiftM } from '../../lib/world/asset-registry';
import { createTownHouseStudy } from '../../lib/world/house-site';
import { createPlacementCache, createSandboxWorld } from '../../lib/world/sandbox-world';

const styleTones = {
	neutral: 'cream',
	memphis: 'pink',
	archigram: 'grey',
	organic: 'cork'
} as const satisfies Record<HouseStyleName, ModelTone>;

const brushParams = {
	width: defaults.sandboxBrushWidthM,
	height: defaults.sandboxBrushHeightM,
	complexity: defaults.sandboxBrushComplexity
};

/** The cladding level a request is built at, with that level's share of the block budget. */
export type Detail = Readonly<{ level: SurfaceLevel; budget: number }>;

/** What the cache hands the build queue for one placement: everything a build needs, read at
 * commit time, and a pure build that runs later at any detail. */
export type PlacementRequest = Readonly<{
	placement: SandboxPlacement;
	parcel?: Parcel;
	salience?: Readonly<{ block: string; features: HouseFeatures }>;
	reason?: string;
	build?: (detail: Detail) => readonly Drawable[];
}>;

/** Uses the Architecture Town fixture as the opening subject of the editable city. */
export function createTownSandbox() {
	const { site, layout, columns, blocks } = createTownHouseStudy();
	const world = createSandboxWorld(site, layout, columns);
	const projection = createSandboxProjection(site, layout, world.holdings);
	const points = blocks.block.outline.map(([x, y]): Vec3 => [
		...projection.toLocal(x, y),
		site.sampleGround(x, y).height
	]);
	const assets = world.listAssets('parcel');
	const kinds = new Map(
		world
			.listAssets('graph-edge')
			.concat(assets)
			.map(({ id, kind }) => [id, kind])
	);
	const parcels = new Map(world.holdings.parcels.map((parcel) => [parcel.id, parcel]));
	const isHouse = (id: string) => kinds.get(id) === 'house';
	const toneOf = (id: string) =>
		isHouse(id) ? styleTones[id.replace('house/court-', '') as HouseStyleName] : 'lawn';
	const readBrushParams = (id: string) => (isHouse(id) ? brushParams : {});
	const previewBody = (parcel: Parcel, id: string, assetId: string, height: number) =>
		projection.projectBody(parcel, isHouse(assetId) ? height : groveLawnLiftM, id, toneOf(assetId));
	/** Draws the brushes on the first parcel every house style can build. */
	function createSpecimens() {
		const sketchOptions = {
			marginRatio: defaults.sandboxSpecimenMarginRatio,
			decimals: defaults.sandboxSpecimenDecimals
		};
		for (const parcel of world.holdings.parcels) {
			if (parcel.publicUse) continue;
			const host = { kind: 'parcel', id: parcel.id } as const;
			const scratch = world.createDocument();
			const placements = assets.map(({ id }) => {
				scratch.apply([
					{ ...world.place(id, host, readBrushParams(id)), seed: defaults.sandboxSpecimenSeed }
				]);
				const placement = scratch.readPlacement(host);
				scratch.undo();
				return { id, placement, house: placement && world.resolveHouse(placement) };
			});
			if (placements.some(({ id, house }) => isHouse(id) && house?.status !== 'placed')) continue;
			return new Map(
				placements.flatMap(({ placement, house }) => {
					if (!placement) return [];
					const { assetId } = placement;
					const drawables =
						house?.status === 'placed'
							? projection.projectParcelHouse(house, [], assetId, {
									level: 'plain',
									budget: blockTriangleBudget,
									tone: toneOf(assetId)
								})
							: projection.projectPlacement(
									world.build(placement),
									kinds.get(assetId) ?? '',
									assetId
								);
					return [[assetId, projectSketch(drawables, sketchOptions)] as const];
				})
			);
		}
		return new Map<string, ReturnType<typeof projectSketch>>();
	}
	return {
		createSpecimens,
		clickSlopPx: defaults.sandboxClickSlopPx,
		world,
		projection,
		points,
		viewContextFill: defaults.sandboxViewContextFill,
		assets,
		brushParams,
		isHouse,
		readBrushParams,
		previewBody,
		parcels,
		/** Turns the current placements and their party walls into deferred build requests. */
		createCache: (document: ReturnType<typeof createSandboxDocument>) =>
			createPlacementCache<PlacementRequest>(
				document,
				(placement, house, adjoining): PlacementRequest => {
					const tone = toneOf(placement.assetId);
					const parcel =
						placement.host.kind === 'parcel' ? parcels.get(placement.host.id) : undefined;
					const where = parcel && { parcel };
					if (house?.status === 'unbuildable') return { placement, ...where, reason: house.reason };
					if (house)
						return {
							placement,
							...where,
							salience: {
								block: house.parcel.blockId,
								features: readHouseFeatures(house.space, house.house)
							},
							build: (detail) =>
								projection.projectParcelHouse(house, adjoining, placement.id, { ...detail, tone })
						};
					const object = world.build(placement);
					return {
						placement,
						...where,
						build: () =>
							projection.projectPlacement(object, kinds.get(placement.assetId) ?? '', placement.id)
					};
				},
				world.resolveHouse
			)
	};
}
