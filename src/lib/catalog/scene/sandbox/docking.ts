import type { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';

/** Drop 28 cm under gravity, rebound at the seat, then rest. Units are metres and seconds. */
export function seatingLift(seconds: number) {
	const t = Math.max(0, seconds),
		impact = Math.sqrt(0.56 / 9.81);
	if (t < impact) return 0.28 - 4.905 * t * t;
	const rebound = t - impact;
	return rebound > 0.5 ? 0 : 0.038 * Math.exp(-24 * rebound) * Math.abs(Math.sin(34 * rebound));
}

/** Swing a docked casting about its top socket. Applying the rigid transform to the batch
 * carries its lip, pigment and Three.js ray targets along with the clay. */
export function dockPose(
	group: Group,
	capsule: Extract<Primitive, { kind: 'capsule' }>,
	elapsed: number
) {
	const t = Math.max(0, elapsed),
		angle = t >= 1.25 ? 0 : 0.09 * Math.exp(-5 * t) * Math.sin(12 * t);
	const x = (capsule.from[0] + capsule.to[0]) / 2,
		y = (capsule.from[2] + capsule.to[2]) / 2 + capsule.radius;
	const c = Math.cos(angle),
		s = Math.sin(angle);
	group.rotation.z = angle;
	group.position.set(x * (1 - c) + s * y, seatingLift(t) + y * (1 - c) - s * x, 0);
}
