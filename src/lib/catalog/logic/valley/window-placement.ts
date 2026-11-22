import { hash } from '../../core/random';
import { sampleBand, type ValleyParameters } from './parameters';

const WINDOW_CHANNEL = 7;
const OPEN_BANK_CHANNEL = 5;
const WINDOW_CHORD_REACH_M = 1000;
const CLOSE_BANK_OFFSETS_M = [185, 285] as const;
const OPEN_BANK_OFFSETS_M = [375, 430] as const;
export const MAX_WINDOW_OFFSET_M = OPEN_BANK_OFFSETS_M[1];

/** Returns the open bank viewed downstream. A positive side is left of the course. */
export function openBankSide(seed: number, override?: ValleyParameters['openBank']): 1 | -1 {
	if (override) return override === 'left' ? 1 : -1;
	return hash(seed, 0, OPEN_BANK_CHANNEL) < 0.5 ? 1 : -1;
}

/** Draws the off-channel position along the sampling window's cross-axis. */
export function windowOffset(seed: number, parameters: ValleyParameters): number {
	const across = sampleBand(parameters.windowAcross, hash(seed, 0, WINDOW_CHANNEL));
	const side = across < 0 ? -1 : 1;
	const ranges =
		side === openBankSide(seed, parameters.openBank) ? OPEN_BANK_OFFSETS_M : CLOSE_BANK_OFFSETS_M;
	return side * sampleBand(ranges, Math.abs(across));
}

const HEADING_ALIGNMENT = [0.22, 0.62] as const;

/** Aligns more of the local heading as less room remains on the near side of the frame. */
export function alignmentFor(offsetM: number): number {
	const closest = CLOSE_BANK_OFFSETS_M[0];
	return sampleBand(
		HEADING_ALIGNMENT,
		(Math.abs(offsetM) - closest) / (MAX_WINDOW_OFFSET_M - closest)
	);
}

/** Places the field origin off the course along the normal of its broad chord. */
export function placeCourse(
	xy: Float64Array,
	midpoint: number,
	spacingM: number,
	offset: number
): void {
	const steps = Math.round(WINDOW_CHORD_REACH_M / spacingM);
	const before = 2 * (midpoint - steps);
	const after = 2 * (midpoint + steps);
	const chord = Math.atan2(xy[after + 1] - xy[before + 1], xy[after] - xy[before]);
	const originX = xy[2 * midpoint] - offset * Math.sin(chord);
	const originY = xy[2 * midpoint + 1] + offset * Math.cos(chord);
	for (let i = 0; i < xy.length; i += 2) {
		xy[i] -= originX;
		xy[i + 1] -= originY;
	}
}
