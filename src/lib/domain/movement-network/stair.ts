import { interpolation, type Vec3 } from '../../core/geometry';
import { defaults } from '../../../config/movement-network';
import type { Mesh } from '../../core/mesh';

export function drawStair(
	body: Mesh,
	points: readonly Vec3[],
	stairWidthM = defaults.stairWidthM as number
) {
	const { stairRiseM, deckThicknessM } = defaults;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		if (a[0] === b[0] && a[1] === b[1]) continue;
		const count = Math.max(1, Math.ceil(Math.abs(b[2] - a[2]) / stairRiseM));
		const ascending = b[2] >= a[2];
		for (let step = 0; step < count; step++) {
			const [x, y] = interpolation(a, b, step / count);
			const [u, v] = interpolation(a, b, (step + 1) / count);
			const z = a[2] + ((b[2] - a[2]) * (step + Number(ascending))) / count;
			body.ribbon(
				[
					[x, y, z],
					[u, v, z]
				],
				stairWidthM,
				deckThicknessM
			);
		}
	}
}
