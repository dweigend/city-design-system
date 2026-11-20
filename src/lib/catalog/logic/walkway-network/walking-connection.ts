import { movementNetwork, walkingCapacity, type MovementPort } from '../movement-network';
import type { Vec3 } from '../parametrik/types';
import { walkingProfile } from './walking-profile';

export const walkingConnectionProfile = {
	width: walkingProfile.width,
	headroom: walkingProfile.headroom,
	rampGrade: walkingProfile.gradeLimit,
	stairGrade: walkingProfile.treadRise / walkingProfile.going,
	treadGoing: walkingProfile.going,
	// Scenario assumption in travellers/minute: one traveller per metre of width per second.
	capacity: walkingCapacity(walkingProfile.width)
};

/** Fits an already surveyed, outward-facing house deck and its court landing in world metres.
 * Returns the ports and any accepted path or two-ended stair for projection and routing. */
export function houseCourtConnection(id: string, court: Vec3, entrance: Vec3) {
	return walkingLink(id, court, entrance, 'court', 'entrance');
}
/** Fits opposing walking mouths on a surveyed straight alignment, including stock tread going. */
export function walkingLink(
	id: string,
	court: Vec3,
	entrance: Vec3,
	first: MovementPort['kind'],
	last: MovementPort['kind']
) {
	const heading = Math.atan2(entrance[1] - court[1], entrance[0] - court[0]);
	const profile = walkingConnectionProfile;
	const ports: MovementPort[] = [
		{
			id: id + '/' + first,
			kind: first,
			position: court,
			heading,
			accepts: [last, 'stair'],
			width: profile.width,
			headroom: profile.headroom
		},
		{
			id: id + '/' + last,
			kind: last,
			position: entrance,
			heading: heading + Math.PI,
			accepts: [first, 'stair'],
			width: profile.width,
			headroom: profile.headroom
		}
	];
	return movementNetwork(ports, [], [{ id, from: ports[0].id, to: ports[1].id, profile }]);
}
