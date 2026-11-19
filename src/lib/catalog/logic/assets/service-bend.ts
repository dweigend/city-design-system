import type { Vec3 } from '../parametrik/types';
import { pipe } from './assembly';

function toward(a: Vec3, b: Vec3, fraction: number): Vec3 {
	return [
		a[0] + (b[0] - a[0]) * fraction,
		a[1] + (b[1] - a[1]) * fraction,
		a[2] + (b[2] - a[2]) * fraction
	];
}
function length(a: Vec3, b: Vec3) {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Forms tangent bends in one continuous service pipe. Knots and radius are in metres. */
export function serviceBend(knots: Vec3[], radius: number, slot: string) {
	const points: Vec3[] = [knots[0]];
	for (let i = 1; i < knots.length - 1; i++) {
		const corner = knots[i],
			before = knots[i - 1],
			after = knots[i + 1];
		const incoming = length(corner, before),
			outgoing = length(corner, after);
		const setback = Math.min(2.5 * radius, incoming * 0.43, outgoing * 0.43);
		const start = toward(corner, before, setback / incoming);
		const end = toward(corner, after, setback / outgoing);
		for (let j = 0; j <= 4; j++) {
			const t = j / 4;
			points.push(toward(toward(start, corner, t), toward(corner, end, t), t));
		}
	}
	points.push(knots[knots.length - 1]);
	return pipe(points, radius, slot);
}
