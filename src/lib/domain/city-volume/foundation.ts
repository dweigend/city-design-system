import type { Vec3 } from '../../core/geometry';
import { levelHeight } from './settlement';

type Corner = Readonly<{ id: string; position: Vec3 }>;
/** The index of a point on the common level grid. */
export function planeIndex(datumZ: number, z: number) {
	return (z - datumZ) / levelHeight;
}

type GroundColumn = Readonly<{ corners: readonly { position: Vec3 }[]; levels: number }>;

/** Bounds of the occupied plane indices. Foundations sit on individual terrain corners;
 * the roof is the nominal number of levels above the plane at or above the highest corner. */
export function columnPlanes({ corners, levels }: GroundColumn, datumZ: number) {
	let first = Infinity;
	let highest = -Infinity;
	for (const {
		position: [, , z]
	} of corners) {
		const index = planeIndex(datumZ, z);
		first = Math.min(first, Math.max(0, Math.floor(index)));
		highest = Math.max(highest, index);
	}
	const base = Math.max(0, Math.ceil(highest));
	// The cap is horizontal and has at least one occupied bay below it.
	const foundation = Math.max(first + 1, base);
	return { first, foundation, roof: base + levels };
}

/** Reads the horizontal roof elevation in world meters on the common 7 m plane grid. */
export function columnRoof(column: GroundColumn, datumZ: number) {
	return planeElevation(datumZ, columnPlanes(column, datumZ).roof);
}

/** Elevation of one level on the common 7 m grid. */
export function planeElevation(datumZ: number, level: number) {
	return datumZ + levelHeight * level;
}

/** Clamps a corner to the named terrain contact at or below the terrain. */
export function cornerAt({ id, position: [x, y, z] }: Corner, datumZ: number, level: number) {
	const plane = planeElevation(datumZ, level);
	const ground = level === 0 || plane <= z;
	return {
		id: `vertex/${id}/level/${ground ? 0 : level}`,
		position: [x, y, ground ? z : plane] as Vec3,
		level: ground ? 0 : level
	};
}

/** Iterates the bay rings from the lowest ground contact to the roof on the common grid. */
export function* columnBays(
	column: Readonly<{ corners: readonly Corner[]; levels: number }>,
	datumZ: number
) {
	const { first, roof } = columnPlanes(column, datumZ);
	const ring = (level: number) => column.corners.map((corner) => cornerAt(corner, datumZ, level));
	let bottom = ring(first);
	for (let level = first; level < roof; level++) {
		const top = ring(level + 1);
		yield { level, bottom, top };
		bottom = top;
	}
}
