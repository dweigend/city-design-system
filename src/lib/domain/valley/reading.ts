import { lakeDistance, type Lake } from './lake';

type Sample = (x: number, y: number) => Readonly<{ height: number; water: number; bank: number }>;

/** What covers the ground at a point. */
export type GroundCover = 'dry' | 'river' | 'lake';

/** One ground reading in meters, with slope as rise over run. */
export type GroundReading = Readonly<{
	height: number;
	water: number;
	bank: number;
	slope: number;
	cover: GroundCover;
}>;

const probeM = 2.5;

/** Reads one point with a central-difference slope over 5 m and its cover. */
export function readGround(sample: Sample, lake: Lake | null, x: number, y: number): GroundReading {
	const { height, water, bank } = sample(x, y);
	const dx = sample(x + probeM, y).height - sample(x - probeM, y).height;
	const dy = sample(x, y + probeM).height - sample(x, y - probeM).height;
	const cover: GroundCover =
		bank > 0 ? 'dry' : lake && lakeDistance(lake, x, y) < 0 ? 'lake' : 'river';
	return Object.freeze({
		height,
		water,
		bank,
		slope: Math.hypot(dx, dy) / (2 * probeM),
		cover
	});
}
