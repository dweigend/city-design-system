import { roomOnDeck } from './deck-outline';
import { worldSize } from './objects';
import type { Body, Level, Point, Solid, Plan } from './types';

type XY = [number, number];
type Spot = { position: Point; level: number; height: number; count: number };
function terrace(plate: Solid) {
	if (plate.kind === 'prism')
		return { ring: plate.polygon, holes: plate.holes ?? [], z: plate.z + plate.height };
	if (plate.kind !== 'box') return;
	const [x, y, z] = plate.position,
		[w, d, h] = plate.size;
	const ring: XY[] = [
		[x, y],
		[x + w, y],
		[x + w, y + d],
		[x, y + d]
	];
	return { ring, holes: [], z: z + h };
}
function obstacles(bodies: Body[]) {
	return bodies.map((b) => {
		const [w, d] = worldSize(b),
			[x, y] = b.position;
		return (u: number, v: number) => {
			const c = b.band?.court;
			if (c && Math.max(Math.abs(u - c.center[0]), Math.abs(v - c.center[1])) < c.width / 2 - 0.2)
				return false;
			return Math.abs(x - u) < w / 2 + 0.2 && Math.abs(y - v) < d / 2 + 0.2;
		};
	});
}
function places(shape: NonNullable<ReturnType<typeof terrace>>, bodies: Body[]) {
	const xs = shape.ring.map((p) => p[0]),
		ys = shape.ring.map((p) => p[1]);
	const x0 = Math.min(...xs),
		x1 = Math.max(...xs),
		y0 = Math.min(...ys),
		y1 = Math.max(...ys);
	const blocked = obstacles(bodies),
		result: Point[] = [];
	for (let x = x0 + 0.45; x <= x1 - 0.35; x += 1)
		for (let y = y0 + 0.45; y <= y1 - 0.35; y += 1) {
			if (blocked.some((f) => f(x, y)) || !roomOnDeck(shape.ring, shape.holes, x, y, 0.38, 0.35))
				continue;
			result.push([x, y, shape.z]);
		}
	return result;
}
function groups(
	points: Point[],
	level: number,
	seed: number,
	guests: number,
	shape: NonNullable<ReturnType<typeof terrace>>
) {
	const spots: Spot[] = [];

	const occupied = new Set<Point>();
	for (let i = 0; i < points.length && guests > 0; i++) {
		const a = points[(i + (seed >>> 0)) % points.length];
		if (occupied.has(a)) continue;
		const b =
			guests > 1 && roomOnDeck(shape.ring, shape.holes, a[0], a[1] + 0.5, 0.66, 0.8)
				? points.find((b) => !occupied.has(b) && a[0] === b[0] && Math.abs(b[1] - a[1] - 1) < 1e-6)
				: undefined;
		const count = b ? 2 : 1;
		spots.push({ level, position: [a[0], a[1] + (b ? 0.5 : 0), a[2]], count, height: 1.75 });
		occupied.add(a);
		if (b) occupied.add(b);
		guests -= count;
	}
	return spots;
}
/** Places unscaled singles and pairs using one sample per square metre of clear walking surface. */
export function terraceLife(
	site: Plan['site'],
	levels: Level[],
	parts: Solid[],
	crown: Body,
	seed: number
) {
	const { id, center, width, depth } = site;
	const fits = ([x, y]: Point) =>
		Math.abs(x - center[0]) <= width / 2 - 0.6 && Math.abs(y - center[1]) <= depth / 2 - 0.42;
	let remainder = 8.75;
	return [...levels, undefined].flatMap((l, i) => {
		const prefix = id + '/level/' + i + '/';
		const plate = parts.find((p) =>
			l ? p.id === prefix + 'deck' || p.id === prefix + 'landing' : p.id === id + '/roof-walk'
		);
		if (!plate) return [];
		const shape = terrace(plate);
		if (!shape) return [];
		const points = places(shape, l?.bodies ?? [crown]);
		remainder += points.length;
		const guests = Math.floor(remainder / 17.5);
		remainder -= guests * 17.5;
		return groups(points.filter(fits), i, seed + i, guests, shape).map((p) => ({
			...p,
			structuralRole: 'occupant' as const,
			carrier: plate.id
		}));
	});
}
