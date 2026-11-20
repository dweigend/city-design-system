import { clipPolygon, rotated, type Point2 } from '../ansicht/geometrie';
import type { Primitive } from '../parametrik/types';
import { wallContacts, type TerrainGrid, type TerrainCell } from '../terrain-grid';
import { walkingHeight } from './network-terrain';

type Plate = Extract<Primitive, { kind: 'prism' }>;

function floodPiers(polygon: Point2[], cell: TerrainCell) {
	const [a, b] = cell.corners;
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const normal: Point2 = [(a[1] - b[1]) / length, (b[0] - a[0]) / length];
	const cross = polygon.map(([x, y]) => normal[0] * x + normal[1] * y);
	const lo = Math.min(...cross),
		hi = Math.max(...cross);
	const width = Math.min(0.55, (hi - lo) * 0.28);
	const strips = [
		clipPolygon(polygon, { normal, d: lo + width }),
		clipPolygon(polygon, { normal: [-normal[0], -normal[1]], d: width - hi })
	];
	const tangent: Point2 = [normal[1], -normal[0]];
	return strips.flatMap((strip) => pierSeats(strip, tangent));
}

// Leave the floodway open between short bearing piers around the downhill perimeter.
function pierSeats(strip: Point2[], tangent: Point2) {
	if (strip.length < 3) return [];
	const along = strip.map(([x, y]) => tangent[0] * x + tangent[1] * y);
	const lo = Math.min(...along),
		hi = Math.max(...along),
		span = hi - lo;
	if (span < 2.4) return [strip];
	const bays = Math.ceil(span / 3.5),
		width = Math.min(0.8, span / (2 * bays));
	return Array.from({ length: bays + 1 }, (_, i) => {
		const start = lo + ((span - width) * i) / bays;
		return clipPolygon(clipPolygon(strip, { normal: tangent, d: start + width }), {
			normal: [-tangent[0], -tangent[1]],
			d: -start
		});
	}).filter((p) => p.length >= 3);
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
	const profiles = cell.raised && !holes?.length ? floodPiers(polygon, cell) : [polygon];
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

/** Carries the actual lowest plates into the parcel. Spaced flood piers leave a channel along the contour. */
export function seatedHouse(parts: Primitive[], cells: TerrainCell[], grid: TerrainGrid) {
	const anchor = cells[0];
	const bottom = Math.min(...cells.flatMap((c) => c.corners.map((p) => p[2]))) - 0.05;
	const basePlate = (id: string) => /\/plinth(?:\/\d+)?$/.test(id);
	const hasPlinth = parts.some((p) => basePlate(p.id));
	const feet = parts.flatMap((p) =>
		p.kind === 'prism' && (hasPlinth ? basePlate(p.id) : Math.abs(p.z - anchor.pad) < 1e-7)
			? footings(p, anchor, grid, bottom)
			: []
	);
	return [...parts, ...feet];
}
