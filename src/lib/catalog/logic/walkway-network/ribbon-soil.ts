import type { Vec3 } from '../parametrik/types';
type Ground = (x: number, y: number) => number;
/** Samples the highest finished soil between two plan points in metres. */
export function crossfall(a: Vec3, b: Vec3, ground: Ground) {
	const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
	let highest = -Infinity;
	for (let i = 0; i <= steps; i++) {
		const t = i / steps,
			z = ground(a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]));
		if (Number.isFinite(z)) highest = Math.max(highest, z);
	}
	return highest;
}
