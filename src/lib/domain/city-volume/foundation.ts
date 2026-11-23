import type { Vec3 } from '../../core/geometry';
import { cityVolumeConfig } from './config';
import { levelHeight } from './settlement';

type Corner = Readonly<{ id: string; position: Vec3 }>;
/** The index of a point on the common level grid. */
export function planeIndex(datumZ: number, z: number) {
	const index = (z - datumZ) / levelHeight;
	const nearest = Math.round(index);
	return planeElevation(datumZ, nearest) === z ? nearest : index;
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
		if (!Number.isSafeInteger(Math.floor(index)) || Math.abs(z) > Number.MAX_SAFE_INTEGER)
			throw new RangeError('City ground lies outside the safe plane range');
		first = Math.min(first, Math.max(0, Math.floor(index)));
		highest = Math.max(highest, index);
	}
	const base = Math.max(0, Math.ceil(highest));
	// The cap is horizontal and has at least one occupied bay below it.
	const foundation = Math.max(first + 1, base);
	const roof = base + levels;
	if (
		!Number.isSafeInteger(first) ||
		!Number.isSafeInteger(roof) ||
		roof <= first ||
		roof - first > cityVolumeConfig.maximumOccupiedBands ||
		Math.abs(datumZ) > Number.MAX_SAFE_INTEGER ||
		Math.abs(planeElevation(datumZ, roof)) > Number.MAX_SAFE_INTEGER
	)
		throw new RangeError('City occupied plane span is unsupported');
	return { first, foundation, roof };
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
	return Object.freeze({
		id: `vertex/${id}/level/${ground ? 0 : level}`,
		position: Object.freeze([x, y, ground ? z : plane] as Vec3),
		level: ground ? 0 : level
	});
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
