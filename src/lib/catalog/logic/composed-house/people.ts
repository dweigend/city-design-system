import { hashUnit } from '../../core/random';
import type { Vec3 } from '../parametrik/types';
import { members } from './provider';
import type { HousePart } from './house-object';
import { place } from './asset-fit';
import type { HouseSurfaces } from './surfaces';
/** Places the feet of an unscaled registry figure on its walking surface. */
export function person(position: Vec3, id: string, seed: number, surfaces: HouseSurfaces, yaw = 0) {
	const poses = ['standing', 'waving', 'looking-out'];
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

/** Places a pair inside the first broad stair landing and the roof exit terrace. */
export function landingPeople(
	walk: HousePart[],
	house: HousePart[],
	id: string,
	seed: number,
	surfaces: HouseSurfaces
) {
	const roof = house.find((p) => p.id.endsWith('/roof-walk'));
	const landing = walk.find((p) => p.id.endsWith('/landing') && p.kind === 'prism');
	return [roof, landing].flatMap((p, k) => {
		if (p?.kind !== 'prism' || p.polygon.length !== 4) return [];
		const [a, b, c] = p.polygon;
		if (Math.min(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1])) < 0.85)
			return [];
		const centre = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
		const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
		return [-0.32, 0.32].flatMap((offset, j) =>
			person(
				[
					centre[0] + (offset * (a[0] - b[0])) / length,
					centre[1] + (offset * (a[1] - b[1])) / length,
					p.z + p.height
				],
				id + '/visitors/' + k + '/' + j,
				seed,
				surfaces
			)
		);
	});
}
