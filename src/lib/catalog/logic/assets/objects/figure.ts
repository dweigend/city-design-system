import { bulb } from '../parts';
import { capsule } from './kit-recipe';
import type { Vec3 } from '../../parametrik/types';

export type Pose =
	| 'stand'
	| 'walk-left'
	| 'walk-right'
	| 'run'
	| 'sit'
	| 'lean'
	| 'step'
	| 'carry'
	| 'push'
	| 'reach'
	| 'ride'
	| 'wave'
	| 'point'
	| 'hand'
	| 'read'
	| 'look';

const childBody = { hip: 0.6, shoulderRise: 0.35, headRise: 0.65, radius: 0.1 };
const adultBody = { hip: 0.9, shoulderRise: 0.5, headRise: 0.85, radius: 0.15 };
const strides: Partial<Record<Pose, number>> = { run: 0.45, 'walk-right': -0.3, 'walk-left': 0.3 };
const leans: Partial<Record<Pose, number>> = { lean: 0.3, run: 0.15 };
const seatHips: Partial<Record<Pose, number>> = { sit: 0.55, ride: 0.85 };
type Point = (dx: number, dy: number, z: number) => Vec3;

/** Rigid scale figures must never be scaled. Feet define the deck plane and local +x is forward. */
export function figure(pose: Pose, x: number, y: number, variant: number, child = false) {
	const body = child ? childBody : adultBody;
	const hip = seatHips[pose] ?? body.hip,
		shoulder = hip + body.shoulderRise,
		top = hip + body.headRise;
	const forward = leans[pose] ?? 0,
		stride = strides[pose] ?? 0;
	const r = body.radius,
		span = r + (variant === 2 ? 0.05 : 0);
	const point: Point = (dx, dy, z) => [x + dx, y + dy, z];
	const parts = [
		capsule(
			point(0, 0, hip - 0.1 + span),
			point(forward + 0.05, 0, top - 2 * r - span),
			span,
			'accent'
		),
		bulb(point(forward + 0.05, 0, top - r), r, 1, 'body'),
		bulb(point(forward, 0, top - 0.05), r, 0.05 / r, 'trim')
	];
	for (const side of [-1, 1]) {
		parts.push(...leg(point, pose, side, hip, stride));
		const [dx, dy, z] = hand(pose, side, hip, shoulder, stride);
		const lift = side === 1 && variant === 1 ? 0.05 : 0;
		parts.push(
			capsule(
				point(forward, side * span, shoulder - 0.05),
				point(dx, side * (span + dy), z + lift),
				0.06,
				'body'
			)
		);
	}
	return parts;
}

function leg(point: Point, pose: Pose, side: number, hip: number, stride: number) {
	const y = side * 0.1,
		start = point(0, y, hip);
	if (seatHips[pose] !== undefined) {
		const knee = point(0.35, y, hip);
		const ankle = pose === 'ride' ? 0.3 + side * 0.1 : 0.1;
		return [capsule(start, knee, 0.1, 'accent'), capsule(knee, point(0.35, y, ankle), 0.1, 'trim')];
	}
	if (pose === 'step' && side === 1) {
		const knee = point(0.3, y, hip / 2 + 0.17);
		return [capsule(start, knee, 0.1, 'accent'), capsule(knee, point(0.3, y, 0.27), 0.1, 'trim')];
	}
	return [capsule(start, point(side * stride, y, 0.1), 0.1, 'trim')];
}

function hand(pose: Pose, side: number, hip: number, shoulder: number, stride: number): Vec3 {
	const relaxed: Vec3 = [0, 0.05, hip],
		handle: Vec3 = [0.45, 0.05, 0.95];
	const forward: Vec3 = [0.4, 0.05, 1.1];
	const targets: Partial<Record<Pose, Vec3>> = {
		wave: side === 1 ? [0, 0.2, shoulder + 0.25] : relaxed,
		point: side === 1 ? [0.55, 0.05, shoulder] : relaxed,
		look: side === 1 ? [0.2, 0, shoulder + 0.15] : relaxed,
		hand: [0, 0.35 - (hip > 0.7 ? 0.15 : 0.1), 0.8],
		read: [0.3, 0, shoulder - 0.15],
		reach: [0.4, 0, shoulder + side * 0.1],
		push: handle,
		ride: handle,
		carry: forward,
		lean: forward,
		sit: [0.3, 0, hip + 0.1]
	};
	return targets[pose] ?? [-side * stride, 0.05, hip + 0.05];
}
