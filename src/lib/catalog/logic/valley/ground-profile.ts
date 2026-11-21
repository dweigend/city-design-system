import type { RiverCourse } from './course';

const FLOORS = Object.freeze([
	Object.freeze({ id: 1, kind: 'floodplain', levelM: 1.4 }),
	Object.freeze({ id: 2, kind: 'lower-terrace', levelM: 8.1 }),
	Object.freeze({ id: 3, kind: 'upper-terrace', levelM: 15.5 })
] as const);

export const VALLEY_FLOORS = FLOORS;

function ramp(distanceMm: number, runMm: number): number {
	const t = Math.min(1, distanceMm / runMm);
	return t * (2 - t);
}

function rise(distanceMm: number, centerMm: number, halfRunMm: number): number {
	const t = Math.min(1, Math.max(0, (distanceMm - centerMm + halfRunMm) / (2 * halfRunMm)));
	return t * t * (3 - 2 * t);
}

/** Defines the cross-section in integer-millimeter coordinates and returns height above mean water in meters. */
export function heightAboveWaterM(
	course: RiverCourse,
	stationMm: number,
	signedOffsetMm: number,
	wetHalfWidthMm: number
): number {
	const landwardMm = Math.abs(signedOffsetMm) - wetHalfWidthMm;
	if (landwardMm < 0) return -3.1 * ramp(-landwardMm, 80_000);
	const side = Math.sign(signedOffsetMm);
	const swayMm = Math.round(14_000 * Math.sin(stationMm / 530_000 + course.phaseOffset * 12));
	const first = 95_000 + side * (swayMm + 13_000);
	const second = 245_000 + side * (swayMm - 2_000);
	const [floodplain, lower, upper] = FLOORS;
	return (
		floodplain.levelM * ramp(landwardMm, 36_000) +
		(lower.levelM - floodplain.levelM) * rise(landwardMm, first, 22_000) +
		(upper.levelM - lower.levelM) * rise(landwardMm, second, 26_000)
	);
}
