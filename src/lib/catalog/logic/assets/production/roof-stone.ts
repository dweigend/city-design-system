import { surface } from '../parts';
import { joinRings } from '../../profile-fit';
import type { Vec3 } from '../../parametrik/types';

/** A cut parkland rock with an offset shoulder and a pitched top, after the v6 terraces. */
export function roofStone(x: number, y: number, r: number, phase: number) {
	const points: Vec3[] = [],
		triangles: number[] = [],
		sides = 6;
	for (const [scale, shift, height, pitch, twist] of [
		[0.71, 0, 0, 0, 0],
		[1, -0.06, 0.72, 0.15, 0.19],
		[0.57, 0.22, 1.43, 0.32, -0.11]
	]) {
		for (let i = 0; i < sides; i++) {
			const a = (i * 2 * Math.PI) / sides + phase + twist;
			points.push([
				x + r * (shift + scale * Math.cos(a)),
				y + r * scale * 0.82 * Math.sin(a),
				0.35 + r * (height + pitch * Math.cos(a))
			]);
		}
	}
	joinRings(triangles, 0, 6, sides);
	joinRings(triangles, 6, 12, sides);
	for (let i = 1; i < sides - 1; i++) triangles.push(0, i + 1, i, 12, 12 + i, 13 + i);
	return { ...surface('foot'), kind: 'mesh' as const, points, triangles, lines: [] };
}
