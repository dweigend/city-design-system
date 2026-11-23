import type { Vec3 } from '../../core/geometry';
import { levelHeight } from './settlement';

type GroundColumn = Readonly<{ corners: readonly { position: Vec3 }[]; levels: number }>;

/** Bounds of the occupied plane indices. Foundations sit on individual terrain corners;
 * the roof is the nominal number of levels above the plane at or above the highest corner. */
export function columnPlanes({ corners, levels }: GroundColumn, datumZ: number) {
	let first = Infinity;
	let highest = 0;
	for (const {
		position: [, , z]
	} of corners) {
		const index = (z - datumZ) / levelHeight;
		first = Math.min(first, Math.max(0, Math.floor(index)));
		highest = Math.max(highest, Math.ceil(index));
	}
	return { first, roof: highest + levels };
}

/** Reads the horizontal roof elevation in world meters on the common 7 m plane grid. */
export function columnRoof(column: GroundColumn, datumZ: number) {
	return datumZ + levelHeight * columnPlanes(column, datumZ).roof;
}
