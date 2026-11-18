import type { Vec3 } from '../parametrik/types';
import { deckCorners } from './span';

type Direction = [number, number];
function direction(a: Vec3, b: Vec3): Direction {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	if (!length) throw new RangeError('A walkway span needs a horizontal run');
	return [dx / length, dy / length];
}

/** Join the offset edges of consecutive spans at a common miter on each roof. */
export function routeDecks(points: readonly Vec3[], width: number) {
	const directions = points.slice(1).map((p, i) => direction(points[i], p));
	const decks = directions.map((_, i) => deckCorners(points[i], points[i + 1], width));
	for (let i = 1; i < decks.length; i++) {
		const [x, y, z] = points[i],
			[ax, ay] = directions[i - 1],
			[bx, by] = directions[i];
		const divisor = 1 + ax * bx + ay * by;
		if (divisor <= Number.EPSILON) throw new RangeError('A walkway cannot reverse at a roof');
		const offset = width / (2 * divisor);
		const side = (sign: number): Vec3 => [
			x - (ay + by) * offset * sign,
			y + (ax + bx) * offset * sign,
			z
		];
		decks[i - 1][3] = decks[i][0] = side(-1);
		decks[i - 1][2] = decks[i][1] = side(1);
	}
	decks.forEach(([a, b, c, d], i) => {
		const [dx, dy] = directions[i];
		const run = (p: Vec3, q: Vec3) => (q[0] - p[0]) * dx + (q[1] - p[1]) * dy;
		if (run(a, d) <= 0 || run(b, c) <= 0)
			throw new RangeError('The walkway bend needs a longer run');
	});
	return decks;
}
