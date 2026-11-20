import type { Vec3 } from '../parametrik/types';
import type { TerrainCell, TerrainGrid } from './types';

type XY = readonly [number, number];
type Line = { a: XY; b: XY };
type Section = { start: number; end: number; low: number; high: number };
type Bounds = { left: number; right: number; bottom: number; top: number };
const epsilon = 1e-9; // Parameter on the directed edge.
const charts = new WeakMap<TerrainGrid, { bounds: Bounds; cells: readonly TerrainCell[] }[]>();

function extents(points: readonly (readonly number[])[]): Bounds {
	let left = Infinity,
		right = -Infinity,
		bottom = Infinity,
		top = -Infinity;
	for (const [x, y] of points) {
		left = Math.min(left, x);
		right = Math.max(right, x);
		bottom = Math.min(bottom, y);
		top = Math.max(top, y);
	}
	return { left, right, bottom, top };
}

function overlaps(a: Bounds, b: Bounds) {
	return a.left <= b.right && a.right >= b.left && a.bottom <= b.top && a.top >= b.bottom;
}

function parcels(grid: TerrainGrid, line: Line) {
	let chunks = charts.get(grid);
	if (!chunks) {
		chunks = [...grid.chunks.values()].map((cells) => ({
			cells,
			bounds: extents(cells.flatMap((cell) => cell.corners))
		}));
		charts.set(grid, chunks);
	}
	const bounds = extents([line.a, line.b]);
	return chunks
		.filter((c) => overlaps(c.bounds, bounds))
		.flatMap((c) => c.cells.filter((cell) => overlaps(extents(cell.corners), bounds)));
}

function side(a: Vec3, b: Vec3, p: readonly number[]) {
	return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

// Each barycentric weight varies linearly along the survey. Clip where it becomes zero.
function triangle(line: Line, a: Vec3, b: Vec3, c: Vec3): Section | undefined {
	const area = side(a, b, c);
	if (!area) return;
	let start = 0,
		end = 1,
		za = 0,
		zb = 0;
	for (const [p, q, r] of [
		[a, b, c],
		[b, c, a],
		[c, a, b]
	]) {
		const u = side(p, q, line.a) / area,
			v = side(p, q, line.b) / area;
		if (u < -epsilon && v < -epsilon) return;
		if (u < -epsilon) start = Math.max(start, u / (u - v));
		if (v < -epsilon) end = Math.min(end, u / (u - v));
		za += u * r[2];
		zb += v * r[2];
	}
	if (end - start > epsilon)
		return { start, end, low: za + (zb - za) * start, high: za + (zb - za) * end };
}

function sections(cell: TerrainCell, line: Line, result: Section[]) {
	const points = cell.bank?.points ?? cell.corners;
	const add = (a: number, b: number, c: number) => {
		const piece = triangle(line, points[a], points[b], points[c]);
		if (piece) result.push(piece);
	};
	const n = cell.bank?.divisions;
	if (!n) {
		add(0, 1, 2);
		add(0, 2, 3);
		return;
	}
	// Unraised microtriangles coincide exactly with the coarse terrain underneath.
	for (let j = 0; j < n; j++)
		for (let i = 0; i < n; i++) {
			const a = j * (n + 1) + i,
				d = a + n + 1;
			add(a, a + 1, d + 1);
			add(a, d + 1, d);
		}
}

/** Intersects a directed world-space wall with every crossed finished terrain facet. */
export function surveyWall(grid: TerrainGrid, line: Line, footZ: number) {
	const pieces: Section[] = [];
	if (
		![...line.a, ...line.b, footZ].every(Number.isFinite) ||
		Math.hypot(line.a[0] - line.b[0], line.a[1] - line.b[1]) === 0
	)
		return;
	for (const cell of parcels(grid, line)) sections(cell, line, pieces);
	pieces.sort((a, b) => a.start - b.start || b.end - a.end);
	const stations: { u: number; x: number; y: number; groundZ: number }[] = [];
	const add = (u: number, groundZ: number) =>
		stations.push({
			u,
			groundZ,
			x: line.a[0] + u * (line.b[0] - line.a[0]),
			y: line.a[1] + u * (line.b[1] - line.a[1])
		});
	let cursor = 0;
	for (const { start, end, low, high } of pieces) {
		if (start > cursor + epsilon) return;
		if (end <= cursor + epsilon) continue;
		const z = low + ((high - low) * (cursor - start)) / (end - start);
		if (!stations.length) add(cursor, z);
		if ((z - footZ) * (high - footZ) < 0)
			add(cursor + ((end - cursor) * (footZ - z)) / (high - z), footZ);
		add(end, high);
		cursor = end;
	}
	return cursor >= 1 - epsilon ? stations : undefined;
}
