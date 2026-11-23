import type { Vec3 } from '../../core/geometry';

type Polygon = readonly Vec3[];

const bucketM = 150;
const areaEpsilon = 1e-8;

function signedArea(polygon: Polygon) {
	let area = 0;
	for (const [[x, y], i] of polygon.map((p, i) => [p, i] as const)) {
		const [u, v] = polygon[(i + 1) % polygon.length];
		area += x * v - y * u;
	}
	return area / 2;
}

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
		if (outside.length >= 3 && signedArea(outside) > areaEpsilon) pieces.push(outside);
		if (inside.length < 3 || signedArea(inside) <= areaEpsilon) return [subject];
		remaining = inside;
	}
	return pieces;
}

/** Takes convex water polygons in priority order and returns only the area each adds.
 * This keeps reach joins and caps flush without drawing overlapping water faces. */
export function waterUnion() {
	const index = new Map<string, Polygon[]>();
	return (polygon: Polygon): readonly Polygon[] => {
		if (polygon.length < 3) return [];
		const area = signedArea(polygon);
		if (Math.abs(area) <= areaEpsilon) return [];
		const ordered = area > 0 ? polygon : [...polygon].reverse();
		const keys = bins(ordered);
		const covers = new Set(keys.flatMap((id) => index.get(id) ?? []));
		let pieces = [ordered];
		for (const cover of covers) {
			pieces = pieces.flatMap((piece) => subtract(piece, cover));
			if (!pieces.length) return [];
		}
		for (const id of keys) {
			const list = index.get(id) ?? [];
			list.push(ordered);
			index.set(id, list);
		}
		return pieces;
	};
}
