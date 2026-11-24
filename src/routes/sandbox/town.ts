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
import type { SurfaceLevel } from '../../lib/scene/material';
import { projectSketch } from '../../lib/scene/sketch';
import { createSandboxProjection } from '../../lib/scene/sandbox-projection';
import type { Drawable, ModelTone } from '../../lib/scene/surface';
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
export type HouseRequest = Readonly<{
	placement: SandboxPlacement;
	parcel?: Parcel;
	salience?: Readonly<{ block: string; features: HouseFeatures }>;
	tone: ModelTone;
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
	const assets = world.listAssets('parcel').filter(({ kind }) => kind === 'house');
	const kinds = new Map(
		world
			.listAssets('graph-edge')
			.concat(assets)
			.map(({ id, kind }) => [id, kind])
	);
	const parcels = new Map(world.holdings.parcels.map((parcel) => [parcel.id, parcel]));
	const toneOf = (assetId: string) =>
		styleTones[assetId.replace('house/court-', '') as keyof typeof styleTones] ?? 'white';
	/** Draws each house style on the first parcel every style can build, as a small sketch. */
	function createSpecimens() {
		const host = (id: string) => ({ kind: 'parcel', id }) as const;
		const resolve = (assetId: string, parcel: Parcel) => {
			const scratch = world.createDocument();
			const edit = world.place(assetId, host(parcel.id), brushParams);
			scratch.apply([{ ...edit, seed: defaults.sandboxSpecimenSeed }]);
			const placement = scratch.readPlacement(host(parcel.id));
			return placement && world.resolveHouse(placement);
		};
		for (const parcel of world.holdings.parcels) {
			if (parcel.publicUse) continue;
			let houses;
			try {
				houses = assets.map(({ id }) => resolve(id, parcel));
			} catch {
				continue;
			}
			if (!houses.every((house) => house?.status === 'placed')) continue;
			return new Map(
				houses.map((house, index) => [
					assets[index].id,
					projectSketch(
						house?.status === 'placed'
							? projection.projectParcelHouse(house, [], assets[index].id, {
									level: 'plain',
									budget: blockTriangleBudget,
									tone: toneOf(assets[index].id)
								})
							: [],
						{
							marginRatio: defaults.sandboxSpecimenMarginRatio,
							decimals: defaults.sandboxSpecimenDecimals
						}
					)
				])
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
		parcels,
		toneOf,
		/** Turns the current placements and their party walls into deferred build requests. */
		createCache: (document: ReturnType<typeof createSandboxDocument>) =>
			createPlacementCache<HouseRequest>(
				document,
				(placement, house, adjoining): HouseRequest => {
					const tone = toneOf(placement.assetId);
					const parcel =
						placement.host.kind === 'parcel' ? parcels.get(placement.host.id) : undefined;
					const where = parcel && { parcel };
					if (house?.status === 'unbuildable')
						return { placement, ...where, tone, reason: house.reason };
					if (house)
						return {
							placement,
							...where,
							salience: {
								block: house.parcel.blockId,
								features: readHouseFeatures(house.space, house.house)
							},
							tone,
							build: (detail) =>
								projection.projectParcelHouse(house, adjoining, placement.id, { ...detail, tone })
						};
					const object = world.build(placement);
					return {
						placement,
						tone,
						build: () =>
							projection.projectPlacement(object, kinds.get(placement.assetId) ?? '', placement.id)
					};
				},
				world.resolveHouse
			)
	};
}
