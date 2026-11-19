import { circle } from './assembly';
import { panel } from './objects/forms';
import { ring, surface } from './parts';
import { joinRings } from '../profile-fit';
import type { Vec3 } from '../parametrik/types';

/** A solid fluted front under a contrasting coping, after the horizontal courses on v4. */
export function flutedTile(factor: number, variant: number) {
	const count = 3 + variant;
	const height = 0.98 + factor;
	const pitch = height / count;
	const courses = Array.from({ length: count }, (_, i) =>
		panel(0.19, 0, i * pitch, 0.38, 1.9, pitch * 0.84, 'accent')
	);
	return [
		panel(0.09, 0, 0, 0.18, 1.78, height, 'accent'),
		...courses,
		panel(0.2, 0, height, 0.4, 1.96, pitch * 0.36, 'trim')
	];
}

/** A bevelled tile with a clear bore and a separate projecting eyelet, as in the v4 block. */
export function buttonTile(factor: number) {
	const height = 0.56 + 1.72 * factor;
	const radius = height / 5;
	const points: Vec3[] = [];
	const triangles: number[] = [];
	const directions = circle(1, 64);
	for (const [x, inset, bore] of [
		[0, 0.05, 0],
		[0.05, 0, 0],
		[0.25, 0, 0],
		[0.3, 0.05, 0],
		[0.3, 0, 1],
		[0, 0, 1]
	]) {
		for (const [y, z] of directions) {
			// The fourth-power profile rounds the four corners of the mounting plate.
			const scale = bore ? radius : 1 / Math.hypot(y * y, z * z) ** 0.5;
			points.push([
				x,
				y * scale * (bore ? 1 : 0.97 - inset),
				height / 2 + z * scale * (bore ? 1 : height / 2 - inset)
			]);
		}
	}
	for (let i = 0; i < 6; i++) joinRings(triangles, i * 64, ((i + 1) % 6) * 64, 64);
	return [
		{ ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] },
		ring([0.37, 0, height / 2], radius + 0.105, radius, 0.14, 'channel')
	];
}
