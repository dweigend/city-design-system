import { random } from './random';
import { box, clamp, type Primitive } from './types';
export function attractor({
	x,
	y,
	radius,
	height,
	seed
}: {
	x: number;
	y: number;
	radius: number;
	height: number;
	seed: number;
}): Primitive[] {
	x = clamp(x, -16, 16);
	y = clamp(y, -16, 16);
	radius = clamp(radius, 4, 32);
	height = clamp(height, 1, 20);
	const out: Primitive[] = [];
	const rng = random(seed);
	for (let i = -4; i <= 4; i++)
		for (let j = -4; j <= 4; j++) {
			const footprint = 2.6 + rng() * 0.4;
			const t = Math.max(0, 1 - Math.hypot(i * 4 - x, j * 4 - y) / radius);
			out.push(
				box(
					`${i}:${j}`,
					[i * 4 - 1.5, j * 4 - 1.5, 0],
					[footprint, footprint, 1 + height * t * t],
					t > 0.65 ? '--cat-business' : '--paper'
				)
			);
		}
	out.push({
		id: 'attractor',
		kind: 'cone',
		position: [x, y, 24],
		radius: 1,
		height: 2,
		role: 'neu',
		token: '--signal',
		material: 'metal'
	});
	return out;
}
