import type { Vec3 } from '../../parametrik/types';
import type { ObjectGeometry } from '../object-geometry';
import { surface } from '../parts';

/** Tensions a fabric panel between ordered corner fixings with a central sag in metres. */
export function sail(
	corners: [Vec3, Vec3, Vec3, Vec3],
	sag: number,
	slot = 'fabric'
): ObjectGeometry {
	return { ...surface(slot), kind: 'membrane', corners, sag };
}
