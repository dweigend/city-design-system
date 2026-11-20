import { plannedPlots } from './planned-ensembles';
import type { planHouse, HouseObstacle } from '../composed-house';
import type { Ensembles } from '../house-brush';
import type { TerrainGrid } from '../terrain-grid';
import { courtFlights, ensembleNetwork, type NetworkCache } from './ensemble-network';
import { blockedOutlines, walkingHeight } from './network-terrain';
import { bodyObstacles } from './network-site';
import type { World } from './world';

const surveys = new WeakMap<TerrainGrid, NetworkCache>();
type Sections = ReturnType<typeof planHouse>[];

function neighbours(sections: Sections, layout: Ensembles) {
	const houses = sections.filter((h) => !h.start && layout.cells.has(h.cells[0].id));
	const byCell = new Map(houses.flatMap((h) => h.cells.map((c) => [c.id, h] as const)));
	const pending = new Set(houses),
		groups: Sections[] = [];
	for (const first of pending) {
		const group = [first];
		pending.delete(first);
		for (const house of group) {
			const adjacent = house.cells.flatMap((c) => layout.cells.get(c.id)?.neighbors ?? []);
			for (const id of adjacent) {
				const next = byCell.get(id);
				if (next && pending.delete(next)) group.push(next);
			}
		}
		if (group.length > 1) groups.push(group.sort((a, b) => a.id.localeCompare(b.id)));
	}
	return groups;
}

/** Connects ground-level composed neighbours, including across one intervening parcel. */
export function networkGroups(
	world: World,
	sections: Sections,
	layout: Ensembles,
	stock: HouseObstacle[]
) {
	const planned = plannedPlots(world.state);
	const groups = neighbours(
		sections.filter((h) => h.cells.every((c) => !planned.has(c.id))),
		layout
	);
	const cache: NetworkCache = surveys.get(world.grid) ?? new Map();
	surveys.set(world.grid, cache);
	const site = {
		terrain: (x: number, y: number) => walkingHeight(world.grid, x, y),
		blocked: (window: Parameters<typeof blockedOutlines>[1]) => blockedOutlines(world, window),
		stock: [...stock, ...sections.flatMap(bodyObstacles)]
	};
	const active = new Set<string>();
	const networks = groups.flatMap((houses) => {
		active.add(houses[0].id);
		const group = ensembleNetwork(houses, site, world.seed, cache);
		return group ? [group] : [];
	});
	for (const id of cache.keys()) if (!active.has(id)) cache.delete(id);
	return [...networks, ...courtFlights(world, sections)];
}
