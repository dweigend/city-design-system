import { panel } from './objects/forms';
import { surface } from './parts';
import type { Vec3 } from '../parametrik/types';

// Each three-sided section closes on the raised curb. Its ridge runs along local x.
function gable(x: number, length: number, halfWidth: number, rise: number, slot: string) {
	const points: Vec3[] = [];
	for (const end of [x - length / 2, x + length / 2]) {
		points.push([end, -halfWidth, 0.18], [end, halfWidth, 0.18], [end, 0, 0.18 + rise]);
	}
	const triangles = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5];
	return { ...surface(slot), kind: 'mesh' as const, points, triangles, lines: [] };
}

/** Two glazed pitches span the curb, with raised transverse frames as on the v8 rooftop. */
export function clerestory(factor: number, variant: number) {
	const rise = 0.56 + 0.98 * factor,
		count = variant + 2;
	return [
		panel(0, 0, 0, 4.8, 2.76, 0.18, 'body'),
		gable(0, 4.62, 1.24, rise, 'glass'),
		...Array.from({ length: count }, (_, i) =>
			gable((i / (count - 1) - 0.5) * 4.62, 0.14, 1.3, rise + 0.06, 'body')
		)
	];
}
