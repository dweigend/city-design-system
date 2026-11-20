import type { Vec3 } from '../../parametrik/types';
import { surface } from '../parts';

type Station = [number, number];
// A flat glazed nose sits on the last station. The continuous shell wraps over the shoulders.
function shoulder(start: number, direction: number, length: number, endRadius: number): Station[] {
	const angle = Math.acos(endRadius);
	return Array.from({ length: 9 }, (_, i) => {
		const t = angle * (1 - i / 8);
		return [start + direction * length * (1 - Math.sin(t) / Math.sin(angle)), Math.cos(t)];
	});
}
/** Closes a softened rectangular module between two end planes, measured along its long axis. */
export function cabinShell(left: number, right: number, nose: number, v: number, halfWidth = 1.25) {
	const height = 2.35,
		shoulderLength = [0.55, 0.9, 0.7][v],
		exponent = [0.48, 0.72, 0.57][v];
	const stations = [
		...shoulder(left, 1, shoulderLength, 0.55),
		...shoulder(right, -1, shoulderLength, nose).reverse()
	];
	const shape = (t: number) => Math.sign(t) * Math.pow(Math.abs(t), exponent);
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const [x, r] of stations)
		for (let i = 0; i < 32; i++) {
			const a = (i * Math.PI) / 16;
			points.push([
				x,
				r * halfWidth * shape(Math.cos(a)),
				0.15 + height / 2 + ((r * height) / 2) * shape(Math.sin(a))
			]);
		}
	for (let k = 1; k < stations.length; k++)
		for (let i = 0; i < 32; i++) {
			const a = (k - 1) * 32 + i,
				b = (k - 1) * 32 + ((i + 1) % 32);
			triangles.push(a, b, b + 32, a, b + 32, a + 32);
		}
	const last = points.length - 32;
	for (let i = 1; i < 31; i++) triangles.push(0, i + 1, i, last, last + i, last + i + 1);
	return { ...surface('shell'), kind: 'mesh' as const, points, triangles, lines: [] };
}
