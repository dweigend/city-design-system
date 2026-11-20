import { movementNetwork, type MovementPort } from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import { flightRun } from './link-grades';
import { walkingProfile } from './walking-profile';

export const walkingConnectionProfile = {
	width: walkingProfile.width,
	headroom: walkingProfile.headroom,
	rampGrade: walkingProfile.gradeLimit,
	stairGrade: walkingProfile.treadRise / walkingProfile.going,
	// Scenario assumption in travellers/minute: one traveller per metre of width per second.
	capacity: 60 * walkingProfile.width
};

/** Fits an already surveyed, outward-facing house deck and its court landing in world metres.
 * Returns the ports and any accepted path or two-ended stair for projection and routing. */
export function houseCourtConnection(id: string, court: Vec3, entrance: Vec3) {
	const heading = Math.atan2(entrance[1] - court[1], entrance[0] - court[0]);
	const profile = walkingConnectionProfile;
	const ports: MovementPort[] = [
		{
			id: id + '/court',
			kind: 'court',
			position: court,
			heading,
			accepts: ['entrance', 'stair'],
			width: profile.width,
			headroom: profile.headroom
		},
		{
			id: id + '/entrance',
			kind: 'entrance',
			position: entrance,
			heading: heading + Math.PI,
			accepts: ['court', 'stair'],
			width: profile.width,
			headroom: profile.headroom
		}
	];
	const run = Math.hypot(entrance[0] - court[0], entrance[1] - court[1]);
	const rise = Math.abs(entrance[2] - court[2]);
	const fits = rise <= profile.rampGrade * run || flightRun(rise, walkingProfile) <= run + 1e-8;
	return movementNetwork(
		ports,
		[],
		fits ? [{ id, from: ports[0].id, to: ports[1].id, profile }] : []
	);
}
