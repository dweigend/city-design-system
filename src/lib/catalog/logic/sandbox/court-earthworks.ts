import { chartPoint, type BankSurface, type TerrainCell, type TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import type { CityPlan } from '../city-plan';
import { courtLanding } from '../walkway-network';
import { courtBench } from './town-grading';
import { required } from '../required';

import { shelfDivisions, terraceShelf } from './terrace-shelf';
import { setbackGrade } from './court-setback';

type Point = readonly number[];
type Height = (x: number, y: number) => number;
type Court = CityPlan['centres'][number]['ensembles'][number];
type Section = ReturnType<typeof edge>;
const reach = 4.5;
const courtDivisions = 12;

function edge(a: Point, b: Point, centre: Point, ground: Height, lots: TerrainCell[]) {
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
	return {
		x: a[0],
		y: a[1],
		nx,
		ny,
		toe,
		setback: setbackGrade(a, b, nx, ny, lots, ground, reach)
	};
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
	const strip = side !== mouth ? side.setback(p, top - 0.055) : undefined;
	if (strip !== undefined) return [Math.max(p[2], strip), 0];
	return bankSlope(p, survey, top, side.toe(p), out, side === mouth);
}

// Two shallow treads project from the court into the fill. A short battered riser
// between them retains the soil; the outer toe rejoins the surveyed hillside.
function terraceFall(t: number, drop: number) {
	const runs = Math.min(3, Math.max(1, Math.round(drop / 0.36)));
	const course = t * runs,
		part = course - Math.floor(course);
	const riser = Math.max(0, Math.min(1, (part - 0.4) / 0.55));
	return (Math.floor(course) + riser * riser * (3 - 2 * riser)) / runs;
}

function bankSlope(
	p: Vec3,
	survey: number,
	top: number,
	toe: number,
	out: number,
	entrance: boolean
) {
	const cut =
		entrance || !Number.isFinite(toe) ? 0 : Math.max(0, Math.min(1.5, survey - top, toe - top));
	const seam = top - 0.055;
	const batter = Math.min(1, Math.max(0, (out - 1.15) / 0.65));
	const t = Math.max(0, out) / reach;
	const daylight = cut > 0 ? Math.max(0, (out - 1.8) / (reach - 1.8)) : terraceFall(t, seam - p[2]);
	const z = seam + cut * batter;
	const entry = entrance ? Math.max(0, 1 - Math.max(0, out) / 1.5) : 1;
	// A cutting rejoins the higher hillside at its surveyed daylight elevation.
	const back = cut > 0 ? Math.max(p[2], toe) : p[2];
	const intended = z + (back - z) * daylight;
	const blend = Math.min(1, (reach - out) / 0.5) * entry;
	const ground = p[2] + (intended - p[2]) * blend;
	const face = out > 1.15 && out < 1.9 ? Math.min(1, cut / 0.55) : 0;
	return [Math.max(p[2], ground), Math.max(face * 0.38, daylight * (1 - daylight) * 0.32)];
}

// Evaluate shared bank vertices in one direction. Reversed chart arithmetic can otherwise
// put the same frontage vertex on opposite sides of a cut or setback boundary.
function bankPoint(cell: TerrainCell, i: number, j: number, n: number): Vec3 {
	if (i > 0 && i < n && j > 0 && j < n) return chartPoint(cell.corners, i / n, j / n);
	const [side, k] = j === 0 ? [0, i] : i === n ? [1, j] : j === n ? [2, n - i] : [3, n - j];
	return sidePoint(cell, side, k, n);
}

function sidePoint(cell: TerrainCell, side: number, k: number, n: number): Vec3 {
	const next = (side + 1) % 4;
	const forward = cell.vertexIds[side] < cell.vertexIds[next];
	const a = cell.corners[forward ? side : next],
		b = cell.corners[forward ? next : side];
	const t = (forward ? k : n - k) / n;
	if (t === 0) return a;
	if (t === 1) return b;
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function finishedBank(platforms: Platform[], p: Vec3, survey: number, fill: number) {
	let height = p[2] + fill,
		tone = 0;
	for (const platform of platforms) {
		const [z, ink] = section(platform, p, survey);
		if (z > height) {
			height = z;
			tone = ink;
		}
	}
	return { height, tone };
}

function bankSurface(cell: TerrainCell, raw: TerrainCell, platforms: Platform[]) {
	const shelf = terraceShelf(cell);
	if (!platforms.length && !shelf) return;
	const divisions = platforms.length ? courtDivisions : shelfDivisions;
	const points: Vec3[] = [],
		shade: number[] = [],
		raised: boolean[] = [];
	for (let j = 0; j <= divisions; j++) {
		for (let i = 0; i <= divisions; i++) {
			const p = bankPoint(cell, i, j, divisions),
				survey = bankPoint(raw, i, j, divisions)[2];
			const { height, tone } = finishedBank(
				platforms,
				p,
				survey,
				shelf?.(i / divisions, j / divisions) ?? 0
			);
			points.push([p[0], p[1], height]);
			shade.push(tone);
			raised.push(height > p[2]);
		}
	}
	const indices = raisedFaces(raised, divisions);
	return indices.length ? ({ points, indices, shade, divisions } satisfies BankSurface) : undefined;
}

function raisedFaces(raised: boolean[], divisions: number) {
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
	return indices;
}

function platform(raw: TerrainGrid, group: Court, ground: Height) {
	const parcel = required(raw.cellsById.get(group.court), 'court parcel');
	const polygon = group.plaza?.polygon ?? parcel.corners;
	const middle = [(polygon[0][0] + polygon[2][0]) / 2, (polygon[0][1] + polygon[2][1]) / 2];
	const lots = group.lots
		.map((id) => required(raw.cellsById.get(id), 'court wing'))
		.filter((c) => !c.raised);
	const edges = polygon.map((a, i) =>
		edge(a, polygon[(i + 1) % polygon.length], middle, ground, lots)
	);
	const approach = required(raw.cellsById.get(group.mouth), 'court approach').center;
	const facing = (e: Section) => (approach[0] - e.x) * e.nx + (approach[1] - e.y) * e.ny;
	const mouth = edges.reduce((a, b) => (facing(a) > facing(b) ? a : b));
	const top = courtLanding(parcel, courtBench(raw, group)).position[2];
	const fronts = edges.flatMap((side, i) => {
		if (side === mouth) return [];
		const a = polygon[i],
			b = polygon[(i + 1) % polygon.length];
		return [
			{
				courtId: group.court,
				edge: i,
				a: [a[0], a[1]] as const,
				b: [b[0], b[1]] as const,
				nx: side.nx,
				ny: side.ny,
				pavingZ: top,
				reach
			}
		];
	});
	return { edges, mouth, top, fronts };
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

/** Refines public court earthworks and planted terraces on a shared parcel chart.
 * Adjoining parcels evaluate the same cross-section at their common edge. */
export function courtEarthworks(raw: TerrainGrid, city: CityPlan, ground: Height) {
	const fronts: NonNullable<TerrainGrid['courtFronts']>[number][] = [];
	const platforms = new Map<string, Platform[]>();
	for (const group of city.centres.flatMap((centre) => centre.ensembles ?? [])) {
		const site = platform(raw, group, ground);
		fronts.push(...site.fronts);
		for (const cell of bankParcels(raw, group, site)) {
			const list = platforms.get(cell.id) ?? [];
			list.push(site);
			platforms.set(cell.id, list);
		}
	}
	const grade = (cell: TerrainCell) => {
		const sites = platforms.get(cell.id);
		if (cell.zone === 'water' || (!sites && !cell.landform)) return cell;
		const bank = bankSurface(
			cell,
			required(raw.cellsById.get(cell.id), 'surveyed bank'),
			sites ?? []
		);
		return bank ? { ...cell, bank } : cell;
	};
	return { grade, fronts };
}
