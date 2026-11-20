import { clipPolygon, rotated, type Point2 } from '../ansicht/geometrie';
import type { Primitive } from '../parametrik/types';
import { wallContacts, type TerrainGrid, type TerrainCell } from '../terrain-grid';
import { walkingHeight } from './network-terrain';

type Plate = Extract<Primitive, { kind: 'prism' }>;

function floodWalls(polygon: Point2[], cell: TerrainCell) {
	const [a, b] = cell.corners;
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const normal: Point2 = [(a[1] - b[1]) / length, (b[0] - a[0]) / length];
	const cross = polygon.map(([x, y]) => normal[0] * x + normal[1] * y);
	const lo = Math.min(...cross),
		hi = Math.max(...cross);
	const width = Math.min(0.55, (hi - lo) * 0.28);
	return [
		clipPolygon(polygon, { normal, d: lo + width }),
		clipPolygon(polygon, { normal: [-normal[0], -normal[1]], d: width - hi })
	];
}

function footings(p: Plate, cell: TerrainCell, grid: TerrainGrid, bottom: number): Primitive[] {
	const polygon = rotated(p.polygon, p.rotation ?? 0);
	const low = Math.min(
		...polygon.flatMap((a, edge) => {
			const contacts = wallContacts(grid, {
				houseId: p.id,
				ring: 0,
				edge,
				a,
				b: polygon[(edge + 1) % polygon.length],
				start: 0,
				end: 1,
				footZ: p.z,
				use: 'wall'
			});
			return contacts.map((contact) =>
				contact.kind === 'surveyed'
					? Math.min(...contact.stations.map((s) => s.groundZ))
					: walkingHeight(grid, ...a)
			);
		})
	);
	const gap = p.z - low;
	if (!(gap > 0.02)) return [];
	const holes = p.holes?.map((h) => rotated(h, p.rotation ?? 0));
	const profiles = cell.raised && !holes?.length ? floodWalls(polygon, cell) : [polygon];
	return profiles.map((profile, i) => ({
		kind: 'prism',
		role: p.role,
		id: p.id + '/foundation/' + i,
		token: '--paper',
		finish: 'beton-schalung',
		material: 'concrete',
		polygon: profile,
		holes,
		z: Math.min(bottom, low),
		height: p.z - Math.min(bottom, low)
	}));
}

/** Carries the actual lowest plates into the parcel. Paired flood walls leave a channel along the contour. */
export function seatedHouse(parts: Primitive[], cells: TerrainCell[], grid: TerrainGrid) {
	const anchor = cells[0];
	const bottom = Math.min(...cells.flatMap((c) => c.corners.map((p) => p[2]))) - 0.05;
	const feet = parts.flatMap((p) =>
		p.kind === 'prism' && Math.abs(p.z - anchor.pad) < 1e-7 ? footings(p, anchor, grid, bottom) : []
	);
	return [...parts, ...feet];
}
