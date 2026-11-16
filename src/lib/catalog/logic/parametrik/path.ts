import { clamp, count, type Primitive, type Vec3 } from './types';
import { random } from './random';
export function path({
	points,
	radius,
	seed
}: {
	points: number;
	radius: number;
	seed: number;
}): Primitive[] {
	const n = count(points, 3, 9),
		rng = random(seed);
	const curve: Vec3[] = Array.from({ length: n }, (_, i) => [
		(i / (n - 1) - 0.5) * 40,
		(rng() - 0.5) * 18,
		5 + rng() * 8
	]);
	return [
		{
			id: 'path',
			kind: 'pipe',
			points: curve,
			radius: clamp(radius, 0.25, 2),
			token: '--cat-business',
			role: 'neu',
			material: 'metal'
		},
		...curve.map((p, i): Primitive => ({
			id: `support-${i}`,
			kind: 'cylinder',
			position: [p[0], p[1], 0],
			radius: 0.3,
			height: p[2],
			token: '--paper',
			role: 'bestand',
			material: 'concrete'
		}))
	];
}
