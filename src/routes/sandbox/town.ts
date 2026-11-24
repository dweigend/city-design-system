import { defaults } from '../../config/sandbox-brush';
import type { Vec3 } from '../../lib/core/geometry';
import { createSandboxProjection } from '../../lib/scene/sandbox-projection';
import type { createSandboxDocument } from '../../lib/domain/sandbox-document';
import { createTownHouseStudy } from '../../lib/world/house-site';
import { createPlacementCache, createSandboxWorld } from '../../lib/world/sandbox-world';

const brushParams = {
	width: defaults.sandboxBrushWidthM,
	height: defaults.sandboxBrushHeightM,
	complexity: defaults.sandboxBrushComplexity
};

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
	return {
		world,
		projection,
		points,
		viewContextFill: defaults.sandboxViewContextFill,
		assets,
		brushParams,
		/** Caches flat drawings against the current placements and their party walls. */
		createCache: (document: ReturnType<typeof createSandboxDocument>) =>
			createPlacementCache(
				document,
				(placement, house, adjoining) => {
					if (house?.status === 'unbuildable') return { drawables: [], reason: house.reason };
					const drawables = house
						? projection.projectParcelHouse(house, adjoining, placement.id)
						: projection.projectPlacement(
								world.build(placement),
								kinds.get(placement.assetId) ?? '',
								placement.id
							);
					return { drawables };
				},
				world.resolveHouse
			)
	};
}
