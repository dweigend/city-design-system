import type { Vec3 } from '../../core/geometry';
import { projectCityVolume } from './index';

export function example() {
	const base: readonly Vec3[] = [
		[0, 0, 1],
		[2, 0, 1],
		[2, 2, 2],
		[0, 2, 2]
	];
	const cells = [{ id: 'cell', base, height: 6, edges: [null, null, null, null] }];
	const sides = base.map((point) => [point]);
	return projectCityVolume({ cells }, new Map([['cell', sides]]), { width: 2, depth: 2 });
}
