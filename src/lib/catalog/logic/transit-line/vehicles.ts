import { chainage, poseAt } from './alignment';
import { DESIGN, VEHICLE, CAR_GAP, type TransitLine, type TransitPose } from './contract';
const DWELL = 3,
	POD_SPACING = 70,
	TRAIN_LIFT = 1.5;
function shuttle(distance: number, speed: number, time: number) {
	const travel = distance / speed,
		half = DWELL + travel,
		period = 2 * half;
	const phase = ((time % period) + period) % period,
		reverse = phase >= half;
	const progress = Math.min(distance, Math.max(0, ((phase % half) - DWELL) * speed));
	return { at: reverse ? distance - progress : progress, reverse };
}
/** Samples detached vehicle centers (meters) and travel directions (radians) on a routed line at
 * finite simulation time in seconds, including negative times. Car and pod identities follow
 * array order through both reversals. Time zero starts the first terminal dwell. No mutation.
 */
export function vehiclePoses(line: TransitLine, timeS: number): TransitPose[] {
	const train = line.kind === 'viaduct',
		vehicle = VEHICLE[line.kind],
		speed = (line.profile ?? DESIGN[line.kind]).speed;
	const pitch = vehicle.length + CAR_GAP,
		span = train ? (vehicle.cars - 1) * pitch + vehicle.length : 0;
	const count = train ? vehicle.cars : Math.max(1, Math.ceil(line.length / POD_SPACING));
	const distances = chainage(line.path);
	return Array.from({ length: count }, (_, i) => {
		const { at, reverse } = shuttle(
			line.length - span,
			speed,
			timeS + (train ? 0 : (i * POD_SPACING) / speed)
		);
		const offset = train ? vehicle.length / 2 + i * pitch : 0;
		const pose = poseAt(line.path, distances, Math.min(line.length, at + offset));
		if (train) pose.position[2] += TRAIN_LIFT;
		if (reverse) {
			pose.headingRad = Math.atan2(-Math.sin(pose.headingRad), -Math.cos(pose.headingRad));
			pose.pitchRad = -pose.pitchRad;
		}
		return pose;
	});
}
