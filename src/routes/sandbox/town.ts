import type { Vec3 } from '../../lib/core/geometry';
import { createSandboxProjection } from '../../lib/scene/sandbox-projection';
import { citySiteParams } from '../../lib/world/city-site';
import { createTownHouseStudy } from '../../lib/world/house-site';
import { createPlacementCache, createSandboxWorld } from '../../lib/world/sandbox-world';

const viewContextFill = 0.25;
const brushParams = { width: 28, height: 14, complexity: 0.6 };

/** Uses the Architecture Town fixture as the opening subject of the editable city. */
export function createTownSandbox() {
	const { site, layout, columns, blocks } = createTownHouseStudy();
	const world = createSandboxWorld(
		{
			seed: layout.seed,
			planFamily: layout.variant,
			citySize: citySiteParams.citySize.default
		},
		site,
		layout,
		columns
	);
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
		viewContextFill,
		assets,
		brushParams,
		/** Builds and projects each changed record once for the current terrain frame. */
		createCache: () =>
			createPlacementCache((placement) => ({
				drawables: projection.projectPlacement(
					world.build(placement),
					kinds.get(placement.assetId) ?? '',
					placement.id
				)
			}))
	};
}
