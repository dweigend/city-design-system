import type { Vec2 } from '../../core/geometry';
import { Random } from '../../core/random';

export type ProfileDatum = Readonly<{
	origin: Vec2;
	bearing: number;
	length: number;
	width: number;
}>;

type Edge = readonly [Vec2, Vec2];
const edgeFraction = 0.17;

export function distanceToEdge([x, y]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2) {
	const dx = bx - ax;
	const dy = by - ay;
	const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function edgeFade(point: Vec2, boundary: readonly Edge[], width: number) {
	const [x, y] = point;
	let inside = false;
	let nearest = width;
	for (const [a, b] of boundary) {
		const [ax, ay] = a;
		const [bx, by] = b;
		if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay)) inside = !inside;
		nearest = Math.min(nearest, distanceToEdge(point, a, b));
	}
	const t = inside ? Math.min(1, nearest / width) : 0;
	return t * t * (3 - 2 * t);
}

function peak(stream: Random, x: number, y: number, width: number, depth: number, weight: number) {
	const u = x + stream.number({ min: -0.016, max: 0.016 });
	const v = y + stream.number({ min: -0.035, max: 0.035 });
	return {
		position: [u, v] as const,
		sample(x: number, y: number) {
			const t = ((x - u) / width) ** 2 + ((y - v) / depth) ** 2;
			return weight * Math.max(0, 1 - t) ** 3;
		}
	};
}

export function createProfile(
	seed: number,
	{ origin: [ox, oy], bearing, length, width }: ProfileDatum,
	{ height, complexity }: { height: number; complexity: number },
	boundary: readonly Edge[],
	edgeWidth: number
) {
	if (![ox, oy, bearing, length, width].every(Number.isFinite) || length <= 0 || width <= 0)
		throw new RangeError('Expected a finite city datum with positive extents');
	const random = Random.create({ seed }).derive('city-profile');
	const cos = Math.cos(bearing);
	const sin = Math.sin(bearing);
	const main = peak(random.derive('main'), 0.055, -0.08, 0.64 - 0.32 * complexity, 0.65, 1);
	const west = peak(random.derive('west'), -0.34, -0.1, 0.27, 0.54, 0.57 * complexity);
	const east = peak(random.derive('east'), 0.39, -0.11, 0.25, 0.52, 0.55 * complexity);
	const [u, v] = main.position;
	const summit = Object.freeze([
		ox + length * u * cos - width * v * sin,
		oy + length * u * sin + width * v * cos
	] as const);
	return Object.freeze({
		summit,
		height(x: number, y: number) {
			const dx = x - ox;
			const dy = y - oy;
			const u = (dx * cos + dy * sin) / length;
			const v = (dy * cos - dx * sin) / width;
			const relief =
				1 - (1 - main.sample(u, v)) * (1 - west.sample(u, v)) * (1 - east.sample(u, v));
			if (relief === 0) return height * edgeFraction;
			return (
				height *
				(edgeFraction + (1 - edgeFraction) * relief * edgeFade([x, y], boundary, edgeWidth))
			);
		}
	});
}
