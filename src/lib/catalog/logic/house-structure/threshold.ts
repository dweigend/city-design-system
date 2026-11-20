import type { MovementPort } from '../movement-network';
import type { HouseStructure } from './contract';

/** What a house threshold lets dock onto it. */
const ACCEPTS = ['path', 'walkway', 'court', 'ramp', 'stair', 'bridge', 'junction'] as const;

/**
 * The surveyed ground threshold of a house as a movement port: kind `entrance`, id
 * `<house id>/threshold`, position in world metres with its level in z, heading outward in
 * radians counterclockwise from +x. Returns undefined for a house that states no threshold.
 * The result is detached.
 */
export function houseThreshold(structure: HouseStructure): MovementPort | undefined {
	const threshold = structure.threshold;
	if (!threshold) return undefined;
	return {
		id: structure.id + '/threshold',
		kind: 'entrance',
		position: [...threshold.position],
		heading: threshold.heading,
		width: threshold.width,
		headroom: threshold.headroom,
		accepts: ACCEPTS
	};
}
