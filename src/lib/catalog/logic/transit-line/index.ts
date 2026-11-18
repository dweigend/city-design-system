import { resolveParams, type ParamOverrides } from '../params';
import type { TerrainGrid } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';
import { alignment, chainage, segment, poseAt } from './alignment';
import {
	DESIGN,
	TRANSIT_PARAMS,
	type TransitProfile,
	type TransitLine,
	type TransitKind,
	type TransitPillar
} from './contract';
import { elevate, groundAt } from './elevation';
export type {
	TransitLine,
	TransitKind,
	TransitStop,
	TransitPillar,
	TransitPose,
	TransitProfile
} from './contract';
export { TRANSIT_PARAMS, VEHICLE } from './contract';
export { lineParts } from './parts';
export { vehiclePoses } from './vehicles';

const MIN_LENGTH = 24; // Fits the full three-car consist with terminal clearance.
const END_MARGIN = 4;
const MAX_STOP_GAP = 180;
function stopSamples(distances: number[]) {
	const length = distances[distances.length - 1];
	for (let intervals = Math.ceil(length / MAX_STOP_GAP); ; intervals++) {
		const samples = Array.from({ length: intervals + 1 }, (_, i) => {
			const target = (length * i) / intervals,
				j = segment(distances, target);
			return target - distances[j] < distances[j + 1] - target ? j : j + 1;
		});
		if (samples.every((j, i) => !i || distances[j] - distances[samples[i - 1]] <= MAX_STOP_GAP))
			return samples;
	}
}
function stations(grid: TerrainGrid, path: Vec3[], distances: number[], shaftOffset: number) {
	return stopSamples(distances).map((i) => {
		const { position, headingRad } = poseAt(path, distances, distances[i]);
		// Keep the offset shaft's surveyed elevation through plain-data serialization.
		const groundZ = groundAt(
			grid,
			position[0] - shaftOffset * Math.sin(headingRad),
			position[1] + shaftOffset * Math.cos(headingRad)
		);
		return { position, headingRad, groundZ };
	});
}
function supports(grid: TerrainGrid, path: Vec3[], distances: number[], profile: TransitProfile) {
	const pillars: TransitPillar[] = [],
		{ supportSpacing, deckRadius } = profile;
	for (
		let at = supportSpacing;
		at <= distances[distances.length - 1] - END_MARGIN;
		at += supportSpacing
	) {
		const [x, y, z] = poseAt(path, distances, at).position;
		pillars.push({ foot: [x, y, groundAt(grid, x, y)], top: z - deckRadius });
	}
	return pillars;
}
/** Routes ordered cell IDs over a grid in world meters, skipping unknown IDs and adjacent repeats.
 * Returns detached data in stroke order, or undefined for fewer than two distinct cells or a
 * rounded plan shorter than 24 m. Neither input is mutated.
 */
export function routeLine(
	grid: TerrainGrid,
	stroke: { id: string; kind: TransitKind; cellIds: readonly string[] },
	overrides?: ParamOverrides<typeof TRANSIT_PARAMS.viaduct>
): TransitLine | undefined {
	const cellIds: string[] = [],
		centers: Vec3[] = [];
	for (const id of stroke.cellIds) {
		const cell = grid.cellsById.get(id);
		if (cell && cellIds.at(-1) !== id) {
			cellIds.push(id);
			centers.push(cell.center);
		}
	}
	if (centers.length < 2) return;
	const { id, kind } = stroke;
	const profile = overrides
		? resolveParams(TRANSIT_PARAMS[kind], undefined, overrides)
		: DESIGN[kind];
	const { radius, grade, clearance } = profile;
	const plan = alignment(centers, radius);
	if ((chainage(plan).at(-1) ?? 0) < MIN_LENGTH) return;
	const path = elevate(grid, plan, grade, clearance),
		distances = chainage(path);
	return {
		id,
		kind,
		...(overrides ? { profile } : {}),
		cellIds,
		path,
		length: distances[distances.length - 1],
		stops: stations(grid, path, distances, profile.shaftOffset),
		pillars: supports(grid, path, distances, profile)
	};
}
