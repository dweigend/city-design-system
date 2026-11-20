import { chartPoint, type BankSurface, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import type { CityPlan } from '../city-plan';
import { courtLanding } from '../walkway-network';
import { courtBench } from './town-grading';
import { required } from '../required';

type Point = readonly number[];
type Height = (x: number, y: number) => number;
type Court = CityPlan['centres'][number]['ensembles'][number];
type Section = ReturnType<typeof edge>;
const reach = 4.5;
const divisions = 12;

function edge(a: Point, b: Point, centre: Point, ground: Height) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	const sign = Math.sign(dy * (a[0] - centre[0]) - dx * (a[1] - centre[1]));
	const nx = (sign * dy) / length,
		ny = (-sign * dx) / length;
	const intervals = Math.ceil(length / 2);
	const toes = Array.from({ length: intervals + 1 }, (_, i) =>
		ground(a[0] + (dx * i) / intervals + reach * nx, a[1] + (dy * i) / intervals + reach * ny)
	);
	const toe = (p: Point) => {
		const along = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length);
		const at = intervals * Math.max(0, Math.min(1, along)),
			i = Math.min(intervals - 1, Math.floor(at));
		return toes[i] + (toes[i + 1] - toes[i]) * (at - i);
	};
	return { x: a[0], y: a[1], nx, ny, toe };
}

type Platform = { edges: Section[]; top: number; mouth: Section };

function nearestEdge({ edges, mouth }: Platform, p: Vec3) {
	let out = -Infinity,
		side = mouth,
		radial = 0;
	for (const e of edges) {
		const distance = (p[0] - e.x) * e.nx + (p[1] - e.y) * e.ny;
		radial += Math.max(0, distance) ** 2;
		if (distance > out) {
			out = distance;
			side = e;
		}
	}
	return { side, out: Math.sqrt(radial) };
}

/** The uncut entrance follows the planting/step reservation. Elsewhere the uphill bank
 * has a battered cut face and the downhill bank fans back to the existing ground. */
function section(platform: Platform, p: Vec3, survey: number) {
	const { top, mouth } = platform;
	const { side, out } = nearestEdge(platform, p);
	if (out >= reach) return [p[2], 0];
	const toe = side.toe(p);
	const cut =
		side === mouth || !Number.isFinite(toe)
			? 0
			: Math.max(0, Math.min(1.5, survey - top, toe - top));
	const seam = top - 0.055;
	const batter = Math.min(1, Math.max(0, (out - 1.15) / 0.65));
	const t = Math.max(0, out) / reach;
	const daylight = cut > 0 ? Math.max(0, (out - 1.8) / (reach - 1.8)) : t * t * (3 - 2 * t);
	const z = seam + cut * batter;
	const entry = side === mouth ? Math.max(0, 1 - Math.max(0, out) / 1.5) : 1;
	// A cutting rejoins the higher hillside at its surveyed daylight elevation.
	const back = cut > 0 ? Math.max(p[2], toe) : p[2];
	const intended = z + (back - z) * daylight;
	const blend = Math.min(1, (reach - out) / 0.5) * entry;
	const ground = p[2] + (intended - p[2]) * blend;
	const face = out > 1.15 && out < 1.9 ? Math.min(1, cut / 0.55) : 0;
	return [Math.max(p[2], ground), Math.max(face * 0.38, daylight * (1 - daylight) * 0.32)];
}

function bankSurface(cell: TerrainCell, raw: TerrainCell, platforms: Platform[]) {
	const points: Vec3[] = [],
		shade: number[] = [],
		raised: boolean[] = [];
	for (let j = 0; j <= divisions; j++) {
		for (let i = 0; i <= divisions; i++) {
			const u = i / divisions,
				v = j / divisions;
			const p = chartPoint(cell.corners, u, v),
				survey = chartPoint(raw.corners, u, v)[2];
			let height = p[2],
				tone = 0;
			for (const platform of platforms) {
				const [z, ink] = section(platform, p, survey);
				if (z > height) {
					height = z;
					tone = ink;
				}
			}
			points.push([p[0], p[1], height]);
			shade.push(tone);
			raised.push(height > p[2]);
		}
	}
	const indices: number[] = [];
	const face = (a: number, b: number, c: number) => {
		if (raised[a] || raised[b] || raised[c]) indices.push(a, b, c);
	};
	for (let j = 0; j < divisions; j++)
		for (let i = 0; i < divisions; i++) {
			const a = j * (divisions + 1) + i,
				d = a + divisions + 1;
			face(a, a + 1, d + 1);
			face(a, d + 1, d);
		}
	return indices.length ? ({ points, indices, shade, divisions } satisfies BankSurface) : undefined;
}

function platform(raw: TerrainGrid, group: Court, ground: Height) {
	const parcel = required(raw.cellsById.get(group.court), 'court parcel');
	const polygon = group.plaza?.polygon ?? parcel.corners;
	const middle = [(polygon[0][0] + polygon[2][0]) / 2, (polygon[0][1] + polygon[2][1]) / 2];
	const edges = polygon.map((a, i) => edge(a, polygon[(i + 1) % polygon.length], middle, ground));
	const approach = required(raw.cellsById.get(group.mouth), 'court approach').center;
	const facing = (e: Section) => (approach[0] - e.x) * e.nx + (approach[1] - e.y) * e.ny;
	const mouth = edges.reduce((a, b) => (facing(a) > facing(b) ? a : b));
	return { edges, mouth, top: courtLanding(parcel, courtBench(raw, group)).position[2] };
}

function bankParcels(raw: TerrainGrid, group: Court, site: Platform) {
	const queue = (group.plaza?.cells ?? [group.court]).map((id) =>
		required(raw.cellsById.get(id), 'plaza parcel')
	);
	const seen = new Set(queue.map((c) => c.id)),
		parcels = [];
	for (const cell of queue) {
		if (
			site.edges.some((e) =>
				cell.corners.every((p) => (p[0] - e.x) * e.nx + (p[1] - e.y) * e.ny > reach)
			)
		)
			continue;
		parcels.push(cell);
		for (const id of cell.neighbors)
			if (id && !seen.has(id)) {
				seen.add(id);
				queue.push(required(raw.cellsById.get(id), 'court bank parcel'));
			}
	}
	return parcels;
}

/** Refines only parcels in reach of a public court. Adjoining parcels evaluate the
 * same cross-section at their shared edge. The entrance slopes away into the walk. */
export function courtEarthworks(raw: TerrainGrid, city: CityPlan, ground: Height) {
	const platforms = new Map<string, Platform[]>();
	for (const group of city.centres.flatMap((centre) => centre.ensembles ?? [])) {
		const site = platform(raw, group, ground);
		for (const cell of bankParcels(raw, group, site)) {
			const list = platforms.get(cell.id) ?? [];
			list.push(site);
			platforms.set(cell.id, list);
		}
	}
	return (cell: TerrainCell) => {
		const sites = platforms.get(cell.id);
		if (!sites || cell.zone === 'water') return cell;
		const bank = bankSurface(cell, required(raw.cellsById.get(cell.id), 'surveyed bank'), sites);
		return bank ? { ...cell, bank } : cell;
	};
}
