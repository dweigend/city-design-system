import { defaults } from './settings';
import type { Random } from '../../core/random';
import { defaultBands, sampleBand } from './parameters';

const {
	guidePlacementChordReachM,
	guideNearBankOffsetBandM,
	guideFarBankOffsetBandM,
	guideHeadingAlignmentBandRatio
} = defaults;

export const maxWindowOffset = guideFarBankOffsetBandM[1];

export function windowOffset(random: Random, openSide: number): number {
	const across = sampleBand(defaultBands.windowAcross, random.number());
	const side = across < 0 ? -1 : 1;
	const ranges = side === openSide ? guideFarBankOffsetBandM : guideNearBankOffsetBandM;
	return side * sampleBand(ranges, Math.abs(across));
}

/** Aligns more of the local heading as less room remains on the near side of the frame. */
export function alignmentFor(offsetM: number): number {
	const closest = guideNearBankOffsetBandM[0];
	return sampleBand(
		guideHeadingAlignmentBandRatio,
		(Math.abs(offsetM) - closest) / (maxWindowOffset - closest)
	);
}

/** Places the field origin off the course along the normal of its broad chord. */
export function placeCourse(
	xy: number[],
	midpoint: number,
	spacingM: number,
	offset: number
): void {
	const steps = Math.round(guidePlacementChordReachM / spacingM);
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
