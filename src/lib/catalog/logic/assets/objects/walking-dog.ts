import type { Vec3 } from '../../parametrik/types';
import { rod, surface } from '../parts';

// A single cut silhouette, from raised tail to muzzle. Two pads rest on the deck.
const sections = [
	[0.32, 0.41, 0.47, 0.035],
	[0.46, 0.26, 0.36, 0.085],
	[0.5, 0, 0.33, 0.09],
	[0.59, 0, 0.34, 0.09],
	[0.62, 0.16, 0.34, 0.1],
	[0.78, 0.16, 0.36, 0.1],
	[0.8, 0, 0.41, 0.085],
	[0.88, 0, 0.52, 0.08],
	[0.91, 0.32, 0.57, 0.065],
	[0.96, 0.36, 0.47, 0.075],
	[1.05, 0.38, 0.44, 0.055]
];
/** Returns the walking companion and its lead as two neutral pieces. */
export function walkingDog() {
	const points: Vec3[] = [],
		triangles = [0, 1, 2, 0, 2, 3];
	for (const [x, lo, hi, w] of sections) {
		const k = points.length;
		points.push([x, 0.24 - w, lo], [x, 0.24 - w, hi], [x, 0.24 + w, hi], [x, 0.24 + w, lo]);
		if (k > 0)
			for (let i = 0; i < 4; i++) {
				const a = k + i,
					b = k + ((i + 1) % 4);
				triangles.push(a - 4, a, b, b - 4, a - 4, b);
			}
	}
	const end = points.length - 4;
	triangles.push(end, end + 2, end + 1, end, end + 3, end + 2);
	return [
		{ ...surface('accent'), kind: 'mesh' as const, points, triangles, lines: [] },
		rod([0.1, 0.11, 0.92], [0.85, 0.24, 0.4], 0.03, 'trim')
	];
}
