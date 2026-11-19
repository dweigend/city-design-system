import { ring, rod } from '../parts';
import { actionFigure } from './activities/action-figure';
/** Two wheel rings and one diagonal identify the bicycle at town scale. */
export function cycleRide(child: boolean, x: number, y: number, v: number, sample: number) {
	const r = child ? 0.19 : 0.26,
		axle = r * 1.45;
	return [
		...[-1, 1].map((side) => ({
			...ring([x + side * axle, y, r], r, r - 0.045, 0.055, 'gear'),
			rotation: Math.PI / 2
		})),
		rod([x - axle, y, r], [x + axle, y, r + 0.27], 0.06, 'skin'),
		...actionFigure('cycle', [x, y, 0], { child, sample, phase: v })
	];
}
