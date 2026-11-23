import { measurePolygon, type Vec3 } from '../../core/geometry';

type Polygon = readonly Vec3[];

const bucketM = 150;
const areaEpsilon = 1e-8;

function bins(polygon: Polygon) {
	const xs = polygon.map(([x]) => Math.floor(x / bucketM));
	const ys = polygon.map(([, y]) => Math.floor(y / bucketM));
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
		if (outside.length >= 3 && measurePolygon(outside).area > areaEpsilon) pieces.push(outside);
		if (inside.length < 3 || measurePolygon(inside).area <= areaEpsilon) return [subject];
		remaining = inside;
	}
	return pieces;
}

const seamToleranceM = 1e-7;

function seamPoint(point: Vec3, covers: ReadonlySet<Polygon>): Vec3 {
	const [x, y] = point;
	for (const cover of covers) {
		for (const [i, [a, b, z]] of cover.entries()) {
			const [u, v, endZ] = cover[(i + 1) % cover.length];
			const dx = u - a;
			const dy = v - b;
			const length = Math.hypot(dx, dy);
			if (!length || Math.abs(dx * (y - b) - dy * (x - a)) > seamToleranceM * length) continue;
			const t = ((x - a) * dx + (y - b) * dy) / length ** 2;
			const tolerance = seamToleranceM / length;
			if (t >= -tolerance && t <= 1 + tolerance)
				return [x, y, z + (endZ - z) * Math.max(0, Math.min(1, t))];
		}
	}
	return point;
}

/** Takes convex water polygons in priority order and returns only the area each adds.
 * This keeps reach joins and caps flush without drawing overlapping water faces. */
export function waterUnion() {
	const index = new Map<string, Polygon[]>();
	const seams = new Map<string, Polygon[]>();
	return (polygon: Polygon): readonly Polygon[] => {
		if (polygon.length < 3) return [];
		const area = measurePolygon(polygon).area;
		if (Math.abs(area) <= areaEpsilon) return [];
		const ordered = area > 0 ? polygon : [...polygon].reverse();
		const keys = bins(ordered);
		const covers = new Set(keys.flatMap((id) => index.get(id) ?? []));
		let pieces = [ordered];
		for (const cover of covers) {
			pieces = pieces.flatMap((piece) => subtract(piece, cover));
			if (!pieces.length) return [];
		}
		const earlier = new Set(keys.flatMap((id) => seams.get(id) ?? []));
		const joined = pieces.map((piece) => piece.map((point) => seamPoint(point, earlier)));
		for (const id of keys) {
			const list = index.get(id) ?? [];
			list.push(ordered);
			index.set(id, list);
		}
		for (const piece of joined) {
			for (const id of bins(piece)) {
				const list = seams.get(id) ?? [];
				list.push(piece);
				seams.set(id, list);
			}
		}
		return joined;
	};
}
