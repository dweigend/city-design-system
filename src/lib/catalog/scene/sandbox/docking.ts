import type { Group } from 'three/webgpu';
import type { Primitive } from '../../logic/parametrik/types';

/** Swing a docked casting about its top socket. Applying the rigid transform to the batch
 * carries its lip, pigment and Three.js ray targets along with the clay. */
export function dockPose(
	group: Group,
	capsule: Extract<Primitive, { kind: 'capsule' }>,
	elapsed: number
) {
	const t = Math.max(0, elapsed),
		angle = t >= 2 ? 0 : 0.13 * Math.exp(-2.6 * t) * Math.cos(5.2 * t) * (1 - t / 2);
	const x = (capsule.from[0] + capsule.to[0]) / 2,
		y = (capsule.from[2] + capsule.to[2]) / 2 + capsule.radius;
	const c = Math.cos(angle),
		s = Math.sin(angle);
	group.rotation.z = angle;
	group.position.set(x * (1 - c) + s * y, y * (1 - c) - s * x, 0);
}
