import { wallContacts, type TerrainGrid } from '../terrain-grid';
import type { QuadCell } from '../quad-grid';

type XY = [number, number];
const surveys = new WeakMap<TerrainGrid, Map<string, number>>();
function edgeContacts(grid: TerrainGrid, cell: QuadCell, edge: number) {
	const xy = ([x, y]: QuadCell['corners'][number]): XY => [x, y];
	return wallContacts(grid, {
		houseId: cell.id,
		ring: 0,
		edge,
		a: xy(cell.corners[edge]),
		b: xy(cell.corners[(edge + 1) % cell.corners.length]),
		start: 0,
		end: 1,
		footZ: cell.pad,
		use: 'entrance'
	});
}

function threshold(grid: TerrainGrid, cell: QuadCell, courtId: string) {
	const contacts = cell.corners
		.flatMap((_, edge) => edgeContacts(grid, cell, edge))
		.filter((c) => c.kind === 'surveyed');
	const front = contacts.filter((c) => c.court?.courtId === courtId);
	const paving = front.flatMap((c) =>
		c.frontage?.relation === 'shared-face' && c.court ? [c.court.pavingZ] : []
	);
	if (paving.length) return Math.min(...paving);
	const stations = (front.length ? front : contacts).flatMap((c) => c.stations);
	if (stations.length) return Math.min(...stations.map((s) => s.groundZ));
}

/** Seats the entrance on the continuous court or on the graded foot of its setback. An inland
 * house steps down to its own low side; the minimum raised floor clears the flood datum. */
export function courtHouseFloor(grid: TerrainGrid, cell: QuadCell, courtId: string) {
	const levels = surveys.get(grid) ?? new Map<string, number>();
	const key = courtId + '/' + cell.id;
	const old = levels.get(key);
	if (old !== undefined) return old;
	const floor = threshold(grid, cell, courtId);
	if (floor === undefined) return;
	const z = grid.cellsById.get(cell.id)?.raised ? Math.max(cell.pad + 0.16, floor) : floor;
	levels.set(key, z);
	surveys.set(grid, levels);
	return z;
}
