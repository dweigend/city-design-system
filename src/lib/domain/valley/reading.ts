import { radius } from './catchment-grid';
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
	let slope: number | undefined;
	const cover: GroundCover = waterKind === null ? 'dry' : waterKind === 'lake' ? 'lake' : 'river';
	return Object.freeze({
		height,
		water,
		bank,
		get slope() {
			if (slope === undefined) {
				const x0 = Math.max(-radius, x - probeM);
				const x1 = Math.min(radius, x + probeM);
				const y0 = Math.max(-radius, y - probeM);
				const y1 = Math.min(radius, y + probeM);
				const dx = (sample(x1, y).height - sample(x0, y).height) / (x1 - x0);
				const dy = (sample(x, y1).height - sample(x, y0).height) / (y1 - y0);
				slope = Math.hypot(dx, dy);
			}
			return slope;
		},
		cover,
		waterKind
	});
}
