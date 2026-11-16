import { LICHT } from '../../data/leitstil';
import type { Koerper, Vec3 } from '../../logic/leitstil';
/** Parallel cast shadow on z=0, only for new additions. */
export function schattenPolygon(k: Koerper): Vec3[] {
	const [x, y] = k.min,
		[X, Y, z] = k.max;
	return (
		[
			[x, y],
			[X, y],
			[X, Y],
			[x, Y]
		] as const
	).map(([a, b]) => [a - (LICHT[0] / LICHT[2]) * z, b - (LICHT[1] / LICHT[2]) * z, 0.02]);
}
