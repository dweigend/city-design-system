import { clipPolygon, rotated, type Point2 } from '../ansicht/geometrie';
import type { BuildingSurface, Primitive, Vec3 } from '../parametrik/types';
import type { TerrainGrid, TerrainCell } from '../terrain-grid';
import { lowerShellEdges, groundPanels } from './shell-ground';
import { planBounds, overlaps } from './network-site';
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

function floodBase(p: Plate, cell: TerrainCell, grid: TerrainGrid, bottom: number): Primitive[] {
	const polygon = rotated(p.polygon, p.rotation ?? 0);
	const holes = p.holes?.map((h) => planBounds(rotated(h, p.rotation ?? 0))) ?? [];
	return floodPiers(polygon, cell).flatMap((profile, i) => {
		if (holes.some((h) => overlaps(h, planBounds(profile)))) return [];
		const ground = profile.map(([x, y]) => walkingHeight(grid, x, y));
		if (ground.every((z) => z >= p.z)) return [];
		const z = Math.min(bottom, ...ground.filter(Number.isFinite));
		return [
			{
				...p,
				id: p.id + '/foundation/' + i,
				polygon: profile,
				holes: undefined,
				rotation: undefined,
				z,
				height: p.z - z
			}
		];
	});
}

function plateEdges(p: Plate): [Vec3, Vec3][] {
	return [p.polygon, ...(p.holes ?? [])].flatMap((ring) => {
		const corners = rotated(ring, p.rotation ?? 0);
		return corners.map((a, i): [Vec3, Vec3] => [
			[...a, p.z],
			[...corners[(i + 1) % corners.length], p.z]
		]);
	});
}

/** Seats the cut shell edges on finished terrain and carries flood floors on spaced perimeter piers. */
export function seatedHouse(
	parts: Primitive[],
	cells: TerrainCell[],
	grid: TerrainGrid,
	seat: number | undefined,
	field: BuildingSurface
) {
	const anchor = cells[0];
	const bottom = Math.min(...cells.flatMap((c) => c.corners.map((p) => p[2]))) - 0.05;
	const exterior = (p: Primitive) => p.kind === 'mesh' && p.id.includes('/exterior/');
	const hasShell = seat !== undefined && parts.some(exterior);
	const hasBase = parts.some((p) => p.buildingSurface?.slot === 'base');
	const bearingPlate = (p: Plate) =>
		hasBase ? p.buildingSurface?.slot === 'base' : Math.abs(p.z - anchor.pad) < 1e-7;
	return parts.flatMap((part): Primitive[] => {
		if (!anchor.raised && seat !== undefined && part.kind === 'mesh' && exterior(part))
			return [part, ...groundPanels(part, lowerShellEdges(part, seat), grid)];
		if (part.kind !== 'prism' || !bearingPlate(part)) return [part];
		const plate = { ...part, buildingSurface: field };
		if (anchor.raised) return [plate, ...floodBase(plate, anchor, grid, bottom)];
		return hasShell ? [plate] : [plate, ...groundPanels(plate, plateEdges(plate), grid)];
	});
}
