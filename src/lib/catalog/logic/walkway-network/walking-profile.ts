import { treadCount } from '../walkway';
import { houseStair } from '../../data/house-stair';
import { profileSolid } from '../linear-path';
import type { Vec3 } from '../parametrik/types';

/** Profile dimensions in metres; the ramp limit is rise divided by plan run. */
export const walkingProfile = {
	width: 2.5,
	thickness: 0.2,
	treadRise: houseStair.rise,
	going: houseStair.going,
	gradeLimit: 0.08,
	railHeight: 1.04,
	postSpacing: 3
} as const;

/** Projects a sloping slab from the same edge stations that locate the handrails. */
export function rampSurface(right: Vec3[], left: Vec3[]) {
	const lower = ([x, y, z]: Vec3): Vec3 => [x, y, z - walkingProfile.thickness];
	return profileSolid(right.map((r, i) => [lower(r), lower(left[i]), left[i], r]));
}

/** Returns the actual bearing elevation of a tread at a point on its surveyed edge. */
export function treadSeat(a: Vec3, b: Vec3, p: Vec3) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1],
		run2 = dx * dx + dy * dy;
	const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / run2;
	if (t < 0 || t > 1 || Math.abs(a[2] + t * (b[2] - a[2]) - p[2]) > 1e-7) return;
	if (Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) > 1e-7 * Math.sqrt(run2)) return;
	const count = treadCount(b[2] - a[2], walkingProfile.treadRise);
	return a[2] + ((b[2] - a[2]) * Math.min(count - 1, Math.floor(count * t))) / (count - 1);
}

/** Classifies the slope using horizontal centreline run in metres. */
export function needsTreads(a: Vec3, b: Vec3) {
	return (
		Math.abs(b[2] - a[2]) > walkingProfile.gradeLimit * Math.hypot(b[0] - a[0], b[1] - a[1]) + 1e-10
	);
}
