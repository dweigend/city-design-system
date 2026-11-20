import { chainage, pathPoint } from '../linear-path';
import type { Vec3 } from '../parametrik/types';
import { fitting, mountFitting } from './town-scatter';
/** Places occasional single walkers along the swept centreline, clear of both landings. */
export function townLife(path: Vec3[], id: string, seed: number) {
	const ds = chainage(path),
		length = ds[ds.length - 1],
		count = Math.floor(length / 28);
	const figure = fitting('kit-scatter-walk');
	return Array.from({ length: count }, (_, i) => {
		const d = ((i + 0.5) * length) / count,
			p = pathPoint(path, ds, d),
			q = pathPoint(path, ds, d + 0.1);
		return mountFitting(
			figure.id,
			figure.variants[0],
			p,
			id + '/life/' + i,
			seed,
			Math.atan2(q[1] - p[1], q[0] - p[0])
		);
	}).flat();
}
