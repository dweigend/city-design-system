import type { planHouse, HouseObstacle } from '../composed-house';
import type { Ensembles } from '../house-brush';
import type { TerrainGrid } from '../terrain-grid';
import { ensembleNetwork, type NetworkCache } from './ensemble-network';
import { blockedOutlines, walkingHeight } from './network-terrain';
import type { World } from './world';

import { bodyObstacles } from './network-site';

const surveys = new WeakMap<TerrainGrid, NetworkCache>();
/** Groups ground-level houses by the same across-alley neighbour survey as the brush. */
export function networkGroups(
	world: World,
	sections: ReturnType<typeof planHouse>[],
	layout: Ensembles,
	stock: HouseObstacle[]
) {
	const groups = new Map<string, typeof sections>();
	for (const section of sections) {
		const owner = layout.cells.get(section.cells[0].id);
		if (!owner || section.start) continue;
		const houses = groups.get(owner.id) ?? [];
		houses.push(section);
		groups.set(owner.id, houses);
	}
	const cache: NetworkCache = surveys.get(world.grid) ?? new Map();
	surveys.set(world.grid, cache);
	const site = {
		terrain: (x: number, y: number) => walkingHeight(world.grid, x, y),
		blocked: (window: Parameters<typeof blockedOutlines>[1]) => blockedOutlines(world, window),
		stock: [...stock, ...sections.flatMap(bodyObstacles)]
	};
	return [...groups.values()].flatMap((houses) => {
		const group = ensembleNetwork(
			houses.sort((a, b) => a.id.localeCompare(b.id)),
			site,
			world.seed,
			cache
		);
		return group ? [group] : [];
	});
}
