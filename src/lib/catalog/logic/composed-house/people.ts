import { hashUnit } from '../../core/random';
import type { Vec3 } from '../parametrik/types';
import { members } from './provider';

import { place } from './asset-fit';
import type { HouseSurfaces } from './surfaces';
/** Places the feet of an unscaled registry figure on its walking surface. */
export function person(
	position: Vec3,
	id: string,
	seed: number,
	surfaces: HouseSurfaces,
	yaw = 0,
	count = 1
) {
	const poses =
		count === 2
			? ['waiting-pair', 'greeting-pair', 'holding-child-hand']
			: ['standing', 'waving', 'looking-out'];
	const pose = poses[Math.floor(hashUnit(seed, id, 'pose') * poses.length)];
	return place(
		members('person-' + pose, 'relaxed', seed, id, surfaces, 'living'),
		[0, 0, 0],
		position,
		[1, 1, 1],
		yaw
	);
}
/** A pair stands along the first bridge segment, with its feet at interpolated deck height. */
export function bridgePair(route: Vec3[], id: string, seed: number, surfaces: HouseSurfaces) {
	const [a, b] = route;
	const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
	if (length < 1.2) return [];
	return [-0.35, 0.35].flatMap((offset, i) => {
		const t = 0.5 + offset / length;
		return person(
			a.map((v, k) => v + t * (b[k] - v)) as Vec3,
			id + '/people/' + i,
			seed,
			surfaces,
			Math.atan2(b[1] - a[1], b[0] - a[0])
		);
	});
}
