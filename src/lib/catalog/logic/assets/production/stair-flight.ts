import type { Vec3 } from '../../parametrik/types';
import { surface } from '../parts';
import { actionFigure } from './activities/action-figure';

const revolution = 2 * Math.PI;
/** A continuous 0.30 m wide helical stringer under the outer nosings, sampled 48 times per turn. */
export function helicalStringer(radius: number, turns: number, height: number) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const segments = 48 * turns;
	for (let i = 0; i <= segments; i++) {
		const t = i / segments,
			a = t * turns * revolution,
			z = t * height;
		const inner = radius - 0.37,
			outer = radius - 0.07,
			top = z + 0.055,
			low = Math.max(0, top - 0.32);
		for (const [r, h] of [
			[inner, low],
			[outer, low],
			[outer, top],
			[inner, top]
		])
			points.push([r * Math.cos(a), r * Math.sin(a), h]);
		if (i === 0) continue;
		for (let j = 0; j < 4; j++) {
			const k = (j + 1) % 4,
				a = (i - 1) * 4,
				b = i * 4;
			triangles.push(a + j, b + j, b + k, a + j, b + k, a + k);
		}
	}
	const end = segments * 4;
	triangles.push(0, 1, 2, 0, 2, 3, end + 2, end + 1, end, end + 3, end + 2, end);
	return { ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] };
}
/** Places the leading foot on the next tread in a clockwise ascending procession. */
export function stairUsers(r: number, steps: number, rise: number) {
	return Array.from({ length: Math.floor(steps / 5) }, (_, i) => {
		const step = i * 5 + 2,
			angle = ((step + 1) * revolution) / 16;
		return actionFigure(
			'climb',
			[r * 0.67 * Math.cos(angle), r * 0.67 * Math.sin(angle), step * rise + 0.22],
			{ heading: angle + Math.PI / 2, slot: 'slats', sample: (i % 5) / 4 }
		);
	}).flat();
}
