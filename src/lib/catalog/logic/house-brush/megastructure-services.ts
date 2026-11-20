import { flowToken } from '../../data/focus';
import type { ColorToken, Primitive, Vec3 } from '../parametrik/types';
import { along, type Bay } from './megastructure-bay';

/** Short walkable landing on the side served by the access flight. */
export function gallery(bay: Bay, side: number, width: number): Primitive[] {
	const outline = [
		[0, 0],
		[1, 0],
		[1, width],
		[0, width]
	].map(([t, s]) => along(bay, side, t, s, 0.88));
	const deck = bay.piece(`gallery-${side}`, flowToken.people, {
		kind: 'prism',
		bearing: 'slab',
		polygon: outline.map(([x, y]) => [x, y]),
		z: outline[0][2],
		height: 0.09 * bay.gauge
	});

	return [deck];
}

/** Straight flight outside the frame. */
export function access(bay: Bay, side: number) {
	const base = bay.level === 0 ? 0 : -0.12;
	const count = 12;
	const top = 0.88;
	const inset = -0.18;
	const first = base + (top - base) / count;
	const city: [Vec3, Vec3, Vec3, Vec3] = [
		along(bay, side, 0, inset, first),
		along(bay, side, 1, inset, top),
		along(bay, side, 1, 0, top),
		along(bay, side, 0, 0, first)
	];
	return Array.from({ length: count }, (_, i) => {
		const corners = [
			[i / count, inset],
			[(i + 1) / count, inset],
			[(i + 1) / count, 0],
			[i / count, 0]
		];
		const step = corners.map(([t, s]) =>
			along(bay, side, t, s, base + ((i + 1) * (top - base)) / count)
		);
		return bay.piece(`tread-${i}`, flowToken.people, {
			kind: 'prism',
			polygon: step.map(([x, y]) => [x, y]),
			z: step[0][2] - 0.08 * bay.gauge,
			height: 0.09 * bay.gauge,
			cityForm: i === 0 ? city : false
		});
	});
}

/** Carries the supply independently of the access flight. */
export function supply(bay: Bay, side: number, token: ColorToken) {
	const points: Vec3[] = [
		along(bay, side, 0.16, -0.1, 0),
		along(bay, side, 0.16, -0.1, 0.5),
		along(bay, side, 0.16, 0.5, 0.5)
	];
	return {
		...bay.piece('supply', token, { kind: 'pipe', points, radius: 0.06 }),
		detail: true,
		cityForm: false as const
	};
}
