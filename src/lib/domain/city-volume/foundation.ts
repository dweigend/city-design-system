import type { Vec3 } from '../../core/geometry';
import { cityVolumeConfig } from '../../../config/city-volume';
import { defaultStoreyHeightM } from '../cell-space';

/** Default number of fine storeys per structural level. */
export const storeysPerLevel = cityVolumeConfig.storeysPerLevel;

/** Default spacing of common upper level planes, in meters. */
export const levelHeight = defaultStoreyHeightM * storeysPerLevel;

/** Lattice address in world meters. Ground contact marks a joint clamped to sampled terrain. */
export type LatticePoint = Readonly<{ id: string; position: Vec3; groundContact?: true }>;
/** The index of a point on the common level grid. */
export function planeIndex(datumZ: number, z: number, levelHeightM = levelHeight) {
	const index = (z - datumZ) / levelHeightM;
	const nearest = Math.round(index);
	return planeElevation(datumZ, nearest, levelHeightM) === z ? nearest : index;
}

type GroundColumn = Readonly<{ corners: readonly { position: Vec3 }[]; levels: number }>;

/** Bounds of the occupied plane indices. Foundations sit on individual terrain corners;
 * the roof is the nominal number of levels above the plane at or above the highest corner. */
export function columnPlanes(
	{ corners, levels }: GroundColumn,
	datumZ: number,
	levelHeightM = levelHeight
) {
	let first = Infinity;
	let highest = -Infinity;
	for (const {
		position: [, , z]
	} of corners) {
		const index = planeIndex(datumZ, z, levelHeightM);
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
		Math.abs(planeElevation(datumZ, roof, levelHeightM)) > Number.MAX_SAFE_INTEGER
	)
		throw new RangeError('City occupied plane span is unsupported');
	for (let level = first; level < roof; level++) {
		if (
			!(
				planeElevation(datumZ, level + 1, levelHeightM) >
				planeElevation(datumZ, level, levelHeightM)
			)
		)
			throw new RangeError('City occupied plane elevations must strictly increase');
	}
	return { first, foundation, roof };
}

/** Reads the horizontal roof elevation in world meters on the specified plane grid. */
export function columnRoof(column: GroundColumn, datumZ: number, levelHeightM = levelHeight) {
	requireLevelSpacing(levelHeightM);
	return planeElevation(datumZ, columnPlanes(column, datumZ, levelHeightM).roof, levelHeightM);
}

export function requireLevelSpacing(levelHeightM: number) {
	if (!(Number.isFinite(levelHeightM) && levelHeightM > 0))
		throw new RangeError('Expected positive finite city level spacing');
}

/** Elevation of one level on the common grid. */
export function planeElevation(datumZ: number, level: number, levelHeightM: number) {
	return datumZ + levelHeightM * level;
}

/** Interns ground-clamped corners by plan vertex and level for one lattice build. */
export function cornerReader(datumZ: number, levelHeightM: number) {
	const byVertex = new Map<string, Map<number, { point: LatticePoint; level: number }>>();
	const points: LatticePoint[] = [];
	return {
		points,
		read(this: void, { id, position: [x, y, z] }: LatticePoint, level: number) {
			const plane = planeElevation(datumZ, level, levelHeightM);
			const ground = level === 0 || plane <= z;
			const index = ground ? 0 : level;
			let rings = byVertex.get(id);
			if (!rings)
				byVertex.set(id, (rings = new Map<number, { point: LatticePoint; level: number }>()));
			let anchor = rings.get(index);
			if (!anchor) {
				const point = Object.freeze({
					id: `vertex/${id}/level/${index}`,
					position: Object.freeze([x, y, ground ? z : plane] as Vec3),
					...(ground && { groundContact: true as const })
				});
				anchor = { point, level: index };
				rings.set(index, anchor);
				points.push(point);
			}
			return anchor;
		}
	};
}

export type CornerReader = ReturnType<typeof cornerReader>;

/** Iterates the bay rings from the lowest ground contact to the roof on the common grid. */
export function* columnBays(
	column: Readonly<{ corners: readonly LatticePoint[]; levels: number }>,
	datumZ: number,
	read: CornerReader['read'],
	levelHeightM: number
) {
	const { first, roof } = columnPlanes(column, datumZ, levelHeightM);
	const ring = (level: number) => column.corners.map((corner) => read(corner, level).point);
	let bottom = ring(first);
	for (let level = first; level < roof; level++) {
		const top = ring(level + 1);
		yield { level, bottom, top };
		bottom = top;
	}
}
