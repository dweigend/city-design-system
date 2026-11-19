import { family, block, legs, row, circle, shell } from './assembly';
import { drum, ring, surface, workshop, path, living } from './parts';
const asset = family('house-fittings', 'deck');
export const houseFittings = [
	asset('twin-outlet', [4, 3], (factor) => [
		...row(2, (t) => ring([0, t * 0.75, 0.65], 0.64, 0.46 * factor, 3.8 * factor)),
		block(0, 0, 0, 0.48, 2.85, 0.26)
	]),
	asset('capsule-cradle', [5, 3], (factor) => [
		...row(2, (t) => ({
			...shell('halfpipe', 0, t * 1.25, 0.15, 2.75, 0.35, 1.17 * factor, 0.16),
			rotation: 0
		})),
		...row(2, (t) => block(t * 0.72, 0, 0, 0.34, 2.95, 0.3))
	]),
	asset('return-landing', [4, 3], (factor) => [
		block(0, 0, 0, 3.8, 2.65, 0.25, path),
		...row(2, (t) => block(t * 1.82, 0, 0.25, 0.14, 2.6, 1.03 * factor, living)),
		block(0, 1.24, 0.25, 3.72, 0.15, 1.03 * factor, living)
	]),
	asset('ring-balustrade', [8, 8], (factor, variant) => [
		...circle(3.83, 16 + variant * 4).map(([x, y]) => drum([x, y, 0], 0.035, 1.15 * factor)),
		{
			...surface(),
			kind: 'torus',
			axis: 'z',
			position: [0, 0, 1.15 * factor],
			radius: 3.83,
			tube: 0.056
		},
		{
			...surface(),
			kind: 'torus',
			axis: 'z',
			position: [0, 0, 0.56 * factor],
			radius: 3.83,
			tube: 0.032
		}
	]),
	asset('helical-walk', [7, 7], (factor, variant) => [
		{
			...surface(path),
			kind: 'helix',
			position: [0, 0, 0],
			radius: 3.32,
			innerRadius: 2.25,
			turns: 1 + variant * 0.5,
			height: 4.5 * factor,
			thickness: 0.16
		},
		{
			...surface(),
			kind: 'helix',
			position: [0, 0, 0.16],
			radius: 3.32,
			innerRadius: 3.23,
			turns: 1 + variant * 0.5,
			height: 4.5 * factor + 0.79,
			thickness: 0.95
		}
	]),
	asset('service-bench', [3, 1.6], (factor) => [
		...legs(1.14 * factor, 0.52, 0.89, 0.065),
		block(0, 0, 0.89, 2.72 * factor, 1.35, 0.12),
		block(-0.8 * factor, 0.16, 1.01, 0.42, 0.49, 0.23, workshop),
		...row(2, (t) => block(-0.8 * factor + t * 0.15, 0.16, 1.24, 0.08, 0.47, 0.16 * factor, path))
	])
];
