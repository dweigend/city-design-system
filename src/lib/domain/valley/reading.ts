import type { terrainSampler, WaterKind } from './terrain-sample';

/** What covers the ground at a point. */
export type GroundCover = 'dry' | 'river' | 'lake';

/** One ground reading in meters, with slope as rise over run. */
export type GroundReading = Readonly<{
	height: number;
	water: number;
	bank: number;
	slope: number;
	cover: GroundCover;
	waterKind: WaterKind;
}>;

const probeM = 2.5;

/** Reads one point with a central-difference slope over 5 m and its cover. */
export function readGround(
	sample: ReturnType<typeof terrainSampler>,
	x: number,
	y: number
): GroundReading {
	const { height, water, bank, waterKind } = sample(x, y);
	const dx = sample(x + probeM, y).height - sample(x - probeM, y).height;
	const dy = sample(x, y + probeM).height - sample(x, y - probeM).height;
	const cover: GroundCover = waterKind === null ? 'dry' : waterKind === 'lake' ? 'lake' : 'river';
	return Object.freeze({
		height,
		water,
		bank,
		slope: Math.hypot(dx, dy) / (2 * probeM),
		cover,
		waterKind
	});
}
