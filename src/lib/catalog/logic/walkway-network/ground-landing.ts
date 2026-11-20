import type { MovementPort } from '../movement-network';
import type { Vec3, Primitive } from '../parametrik/types';
import { deckCorners } from '../walkway';
import { retainingFoot } from './retaining-foot';
import { ribbonProfile } from './ribbon-column';
import { pathSurfaces } from './town-palette';
import { walkingProfile } from './walking-profile';

type Ground = (x: number, y: number) => number;

/** Fits a level turning square and a short paved apron onto three measured terrain stations. */
export function surveyGroundLanding(
	id: string,
	foot: Vec3,
	end: Vec3,
	ground: Ground
): MovementPort | undefined {
	const width = walkingProfile.width;
	const ring = deckCorners(foot, end, width);
	const apron = width / 2;
	const dx = (end[0] - foot[0]) / width,
		dy = (end[1] - foot[1]) / width;
	const toe = [ring[2], end, ring[3]].map(([x, y]): Vec3 => {
		const u = x + apron * dx,
			v = y + apron * dy;
		return [u, v, ground(u, v)];
	});
	const levels = ring.map(([x, y]) => ground(x, y));
	// Give the paved surface a shallow upstand on a bank. A flat site needs none.
	const relief = Math.max(...levels) - Math.min(...levels);
	const top = Math.max(...levels) + Math.min(0.04, relief);
	if (
		!Number.isFinite(top) ||
		!toe.every((p) => Math.abs(p[2] - top) <= apron * walkingProfile.gradeLimit)
	)
		return;
	return {
		id,
		kind: 'path',
		position: [foot[0], foot[1], top],
		heading: Math.atan2(-dy, -dx),
		width,
		headroom: walkingProfile.headroom,
		accepts: ['path', 'stair'],
		groundLanding: { depth: width, toe }
	};
}

/** Seats the ground dock on retaining faces and folds its apron down to the measured soil edge. */
export function projectGroundLanding(port: MovementPort, ground: Ground): Primitive[] {
	const landing = port.groundLanding;
	if (!landing) return [];
	const [x, y, z] = port.position;
	const end: Vec3 = [
		x - landing.depth * Math.cos(port.heading),
		y - landing.depth * Math.sin(port.heading),
		z
	];
	const ring = deckCorners([x, y, z], end, port.width);
	const slab = {
		...pathSurfaces.bearing,
		kind: 'prism' as const,
		id: port.id + '/foot',
		polygon: ring.map(([u, v]): [number, number] => [u, v]),
		z: z - ribbonProfile.depth,
		height: ribbonProfile.depth
	};
	const points: Vec3[] = [ring[2], end, ring[3], ...landing.toe.map((p): Vec3 => [...p])];
	return [
		slab,
		retainingFoot(slab, ground),
		{
			...pathSurfaces.bearing,
			kind: 'mesh',
			id: port.id + '/apron',
			points,
			triangles: [0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4],
			lines: []
		}
	];
}
