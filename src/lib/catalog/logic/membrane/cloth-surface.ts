import type { Vec3 } from '../parametrik/types';
import type { Membrane } from './cloth';
import { clothIntervals, clothOpening } from './inflation';

type Project = (u: number, course: number, v: number) => Vec3;

/** Samples courses on a shared indexed grid, keeping cuts open and both cable families on mesh edges. */
export function clothSurface(
	cols: number,
	courses: number,
	restraint: Membrane['restraint'],
	project: Project
) {
	// A net cable advances half a bay per course. Twice as many columns as rows makes it a grid diagonal.
	const net = restraint === 'net';
	const dx = net ? 4 : 1,
		dy = net ? 2 : 1;
	const columns = cols * dx,
		rows = clothIntervals * dy;
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let j = 0; j <= courses * rows; j++) {
		const course = Math.min(courses - 1, Math.floor(j / rows));
		const y = j - course * rows;
		for (let i = 0; i <= columns; i++) {
			points.push(project(i / columns, course, y / rows));
			if (
				i === columns ||
				j === courses * rows ||
				clothOpening(Math.floor(i / dx), Math.floor(y / dy))
			)
				continue;
			const a = j * (columns + 1) + i,
				b = a + columns + 1;
			// The descending cable cuts this quad from its lower right to its upper left.
			if (net && (i + y + 1) % (2 * rows) === 0) triangles.push(a, a + 1, b, a + 1, b + 1, b);
			else triangles.push(a, a + 1, b + 1, a, b + 1, b);
		}
	}
	return { points, triangles };
}
