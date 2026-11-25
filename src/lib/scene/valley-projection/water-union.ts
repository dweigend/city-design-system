import { measurePolygon, type Vec3 } from '../../core/geometry';
import { waterSeamToleranceM, waterUnionAreaEpsilonM2, waterUnionBucketM } from './constants';

type Polygon = readonly Vec3[];
export type WaterFace = Readonly<{ polygon: Polygon; split: boolean }>;

function bins(polygon: Polygon) {
	const xs = polygon.map(([x]) => Math.floor(x / waterUnionBucketM));
	const ys = polygon.map(([, y]) => Math.floor(y / waterUnionBucketM));
	const result: string[] = [];
	for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
		for (let y = Math.min(...ys); y <= Math.max(...ys); y++) result.push(`${x},${y}`);
	}
	return result;
}

function slice(polygon: Polygon, a: Vec3, b: Vec3) {
	const inside: Vec3[] = [];
	const outside: Vec3[] = [];
	const side = ([x, y]: Vec3) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
	for (const [i, start] of polygon.entries()) {
		const end = polygon[(i + 1) % polygon.length];
		const from = side(start);
		const to = side(end);
		(from >= 0 ? inside : outside).push(start);
		if (from >= 0 === to >= 0) continue;
		const t = from / (from - to);
		const point: Vec3 = [
			start[0] + (end[0] - start[0]) * t,
			start[1] + (end[1] - start[1]) * t,
			start[2] + (end[2] - start[2]) * t
		];
		inside.push(point);
		outside.push(point);
	}
	return { inside, outside };
}

function subtract(subject: Polygon, cover: Polygon) {
	let remaining = subject;
	const pieces: Polygon[] = [];
	for (const [i, a] of cover.entries()) {
		const b = cover[(i + 1) % cover.length];
		if (a[0] === b[0] && a[1] === b[1]) continue;
		const { inside, outside } = slice(remaining, a, b);
		if (outside.length >= 3 && measurePolygon(outside).area > waterUnionAreaEpsilonM2)
			pieces.push(outside);
		if (inside.length < 3 || measurePolygon(inside).area <= waterUnionAreaEpsilonM2)
			return [subject];
		remaining = inside;
	}
	return pieces;
}

function seamPoint(point: Vec3, covers: ReadonlySet<Polygon>): Vec3 {
	const [x, y] = point;
	for (const cover of covers) {
		for (const [i, [a, b, z]] of cover.entries()) {
			const [u, v, endZ] = cover[(i + 1) % cover.length];
			const dx = u - a;
			const dy = v - b;
			const length = Math.hypot(dx, dy);
			if (!length || Math.abs(dx * (y - b) - dy * (x - a)) > waterSeamToleranceM * length) continue;
			const t = ((x - a) * dx + (y - b) * dy) / length ** 2;
			const tolerance = waterSeamToleranceM / length;
			if (t < -tolerance || t > 1 + tolerance) continue;
			if (t <= tolerance) return [x, y, z];
			if (t >= 1 - tolerance) return [x, y, endZ];
			return [x, y, z + (endZ - z) * t];
		}
	}
	return point;
}

function joinSeams(piece: Polygon, earlier: ReadonlySet<Polygon>): WaterFace {
	const polygon: Vec3[] = [];
	for (const [i, a] of piece.entries()) {
		polygon.push(seamPoint(a, earlier));
		const b = piece[(i + 1) % piece.length];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const length = Math.hypot(dx, dy);
		if (length <= 2 * waterSeamToleranceM) continue;
		const tolerance = waterSeamToleranceM / length;
		const fractions: number[] = [];
		for (const cover of earlier) {
			for (const [x, y] of cover) {
				const u = x - a[0];
				const v = y - a[1];
				if (Math.abs(dx * v - dy * u) > waterSeamToleranceM * length) continue;
				const t = (u * dx + v * dy) / length ** 2;
				if (t > tolerance && t < 1 - tolerance) fractions.push(t);
			}
		}
		let previous = 0;
		for (const t of fractions.sort((a, b) => a - b)) {
			if (t - previous <= tolerance) continue;
			polygon.push(seamPoint([a[0] + dx * t, a[1] + dy * t, a[2] + (b[2] - a[2]) * t], earlier));
			previous = t;
		}
	}
	return { polygon, split: polygon.length !== piece.length };
}

/** Takes convex water polygons in priority order and returns only the area each adds.
 * This keeps reach joins and caps flush without drawing overlapping water faces. */
export function waterUnion() {
	const index = new Map<string, Polygon[]>();
	const seams = new Map<string, Polygon[]>();
	return (polygon: Polygon) => {
		if (polygon.length < 3) return [];
		const area = measurePolygon(polygon).area;
		if (Math.abs(area) <= waterUnionAreaEpsilonM2) return [];
		const ordered = area > 0 ? polygon : [...polygon].reverse();
		const keys = bins(ordered);
		const covers = new Set(keys.flatMap((id) => index.get(id) ?? []));
		let pieces = [ordered];
		for (const cover of covers) {
			pieces = pieces.flatMap((piece) => subtract(piece, cover));
			if (!pieces.length) return [];
		}
		const earlier = new Set(keys.flatMap((id) => seams.get(id) ?? []));
		const joined = pieces.map((piece) => joinSeams(piece, earlier));
		for (const id of keys) {
			const list = index.get(id) ?? [];
			list.push(ordered);
			index.set(id, list);
		}
		for (const { polygon } of joined) {
			for (const id of bins(polygon)) {
				const list = seams.get(id) ?? [];
				list.push(polygon);
				seams.set(id, list);
			}
		}
		return joined;
	};
}
