/**
 * Rounding: segment count of round components from a chord error in meters instead of a fixed number.
 *
 * A circle of radius r made of n straight pieces deviates from the circle at the middle of each piece
 * by the sagitta s = r · (1 − cos(π / n)). Rearranged: n = π / acos(1 − s / r).
 * Small pipes need few pieces, large domes many; the visible deviation stays equally
 * small everywhere. Pure, without three.js (PROCEDURAL_PRINCIPLES PN-1: named tolerance).
 */

/** Sagitta in meters for single views (catalog, lab). 4 mm: below one pixel up to close view. */
export const SEHNENFEHLER_M = 0.004;
/** Sagitta in meters for world views with thousands of components (view from far away). */
export const SEHNENFEHLER_GROB_M = 0.04;

export type Rundung = {
	/** Allowed sagitta in meters. */
	tolerance: number;
	/** Lower and upper bound of the segment count per full circle. */
	min: number;
	max: number;
};

export const fein: Rundung = { tolerance: SEHNENFEHLER_M, min: 16, max: 96 };
export const grob: Rundung = { tolerance: SEHNENFEHLER_GROB_M, min: 8, max: 32 };

/**
 * Segments per full circle for radius `radius` (meters). Always a multiple of 4,
 * so that quarter divisions (axes, caps, hemispheres) fall on corners.
 * Invalid radii (≤ 0, NaN, ∞) return the lower bound.
 */
export function kreisSegmente(radius: number, rundung: Rundung = fein): number {
	const { tolerance, min, max } = rundung;
	if (!(radius > 0) || !Number.isFinite(radius)) return min;
	// Sagitta ≥ radius: every circle passes the tolerance, the lower bound suffices.
	if (tolerance >= radius) return min;
	const n = Math.PI / Math.acos(1 - tolerance / radius);
	const quarter = Math.ceil(n / 4) * 4;
	return Math.max(min, Math.min(max, quarter));
}

/** Sagitta in meters of an n-gon with radius r (inverse, for checking and measuring). */
export const pfeilhoehe = (radius: number, segmente: number) =>
	radius * (1 - Math.cos(Math.PI / segmente));
