import { block } from '../assembly';
import { ring, rod } from '../parts';
import { rounded } from './kit-recipe';
import type { Vec3 } from '../../parametrik/types';

/** Upright road wheel facing along x, touching the mounting plane. */
export function wheel(x: number, y: number, r: number) {
	return { ...ring([x, y, r], r, Math.max(0, r - 0.1), 0.12, 'trim'), rotation: Math.PI / 2 };
}

/** Diamond frame, extended front carrier on the cargo cycle, and two contact wheels. */
export function bicycle(x: number, y: number, cargo: boolean, r = 0.35) {
	const rear: Vec3 = [x - 0.55, y, r],
		front: Vec3 = [x + (cargo ? 1.2 : 0.65), y, r];
	const crank: Vec3 = [x, y, 0.3],
		seat: Vec3 = [x - 0.15, y, 0.75],
		stem: Vec3 = [x + 0.45, y, 0.8];
	const edges: [Vec3, Vec3][] = [
		[rear, crank],
		[rear, seat],
		[seat, crank],
		[seat, stem],
		[crank, stem],
		[stem, front]
	];
	return [
		wheel(rear[0], y, r),
		wheel(front[0], y, r),
		...[rear, front].map(([cx, cy, cz]) =>
			block(cx, cy, cz - r + 0.1, 0.12, 0.12, 2 * (r - 0.1), 'frame')
		),
		...edges.map(([a, b]) => rod(a, b, 0.06, 'frame')),
		block(seat[0], y, 0.75, 0.3, 0.2, 0.05, 'trim'),
		rod(stem, [stem[0], y, 0.95], 0.06, 'frame'),
		block(stem[0], y, 0.95, 0.12, 0.5, 0.12, 'frame'),
		...(cargo ? [rounded(x + 0.85, y, 0.5, 0.7, 0.6, 0.45, 'accent')] : [])
	];
}

/** Low four-wheel carrier with a handle within reach of a walking figure. */
export function pushcart(x: number, y: number, pram: boolean, w = 0.8) {
	const wheels = [-1, 1].flatMap((i) =>
		[-1, 1].map((j) => wheel(x + i * (w / 2 - 0.1), y + j * 0.3, 0.2))
	);
	return [
		...wheels,
		rounded(x, y, 0.3, w, 0.55, pram ? 0.35 : 0.15, 'frame'),
		rod([x - w / 2, y, 0.4], [x - w / 2 - 0.2, y, 0.95], 0.06, 'frame'),
		block(x - w / 2 - 0.2, y, 0.95, 0.12, 0.5, 0.12, 'frame'),
		...(pram ? [rounded(x + 0.15, y, 0.65, 0.4, 0.55, 0.3, 'accent')] : [])
	];
}
