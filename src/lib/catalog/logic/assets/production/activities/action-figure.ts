import type { Vec3 } from '../../../parametrik/types';
import { bulb, surface } from '../../parts';
import type { ObjectGeometry } from '../../object-geometry';

export type Gesture = {
	hip: number;
	lean: number;
	feet: [Vec3, Vec3];
	hands: [Vec3, Vec3];
};
function limb(from: Vec3, to: Vec3, radius: number, slot: string): ObjectGeometry {
	return { ...surface(slot), kind: 'capsule', from, to, radius };
}
function bent(from: Vec3, to: Vec3, length: number, bend: number): Vec3 {
	const dx = to[0] - from[0],
		dy = to[1] - from[1],
		dz = to[2] - from[2];
	const span = Math.hypot(dx, dy, dz),
		side = Math.hypot(dx, dz);
	const elbow =
		(bend * Math.sqrt(Math.max(0, length ** 2 - span ** 2 / 4))) / Math.max(0.001, side);
	return [
		(from[0] + to[0]) / 2 - dz * elbow,
		(from[1] + to[1]) / 2,
		(from[2] + to[2]) / 2 + dx * elbow
	];
}
const adult = {
	head: 0.18,
	torso: 0.52,
	waist: 0.205,
	stance: 0.11,
	shoulderWidth: 0.19,
	thigh: 0.45,
	forearm: 0.32,
	leg: 0.095,
	arm: 0.078
};
const junior = {
	head: 0.14,
	torso: 0.36,
	waist: 0.15,
	stance: 0.08,
	shoulderWidth: 0.14,
	thigh: 0.31,
	forearm: 0.23,
	leg: 0.073,
	arm: 0.061
};
/** Builds a rigid adult or child around its hip and fixed hand/foot targets in metres, facing +x. */
export function actionFigure(g: Gesture, child: boolean, x = 0, y = 0) {
	const { head, torso, waist, stance, shoulderWidth, thigh, forearm, leg, arm } = child
		? junior
		: adult;
	const hip = g.hip;
	const shoulderZ = hip + Math.sqrt(torso ** 2 - g.lean ** 2);
	const point = (dx: number, dy: number, z: number): Vec3 => [x + dx, y + dy, z];
	const parts: ObjectGeometry[] = [
		limb(point(0, 0, hip), point(g.lean, 0, shoulderZ - 0.07), waist, 'coat'),
		bulb(point(g.lean + 0.02, 0, shoulderZ + head * 0.98), head, 1, 'skin')
	];
	for (const [i, sign] of [-1, 1].entries()) {
		const ankle = point(...g.feet[i]),
			hand = point(...g.hands[i]);
		const pelvis = point(0, sign * stance, hip);
		const shoulder = point(g.lean, sign * shoulderWidth, shoulderZ - 0.045);
		const knee = bent(pelvis, ankle, thigh, 1);
		const elbow = bent(shoulder, hand, forearm, -1);

		parts.push(
			limb(pelvis, knee, leg * 1.08, 'coat'),
			limb(knee, ankle, leg, 'gear'),
			limb(shoulder, elbow, arm * 1.12, 'coat'),
			limb(elbow, hand, arm, 'skin')
		);
	}
	return parts;
}
