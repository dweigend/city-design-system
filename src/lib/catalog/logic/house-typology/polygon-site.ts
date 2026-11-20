import { cell, grid } from '../parametrik/raster/geometry';
import { toPatch } from '../parametrik/raster/universal';
import { patchGrid } from '../quad-grid';
import type { Point2 } from '../parametrik/vocab';
import type { HouseUse } from '../../data/house-body';
import type { HouseEnvelope } from './envelope';
import type { HouseSite } from './site';

/** Adapts a surveyed simple ring in metres to the house carrier with its boundary fixed. */
export function polygonHouseSite(
	id: string,
	ring: readonly Point2[],
	uses: readonly HouseUse[],
	seed: number,
	envelope: Partial<HouseEnvelope> = {}
): HouseSite {
	const patch = toPatch(grid('square', [cell([...ring], id)]), { seed, iterations: 0 });
	const { cells } = patchGrid(patch);
	return { cells, stacks: new Map(cells.map((c) => [c.id, uses])), seed, envelope };
}
