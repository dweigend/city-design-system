import { flowToken } from '../../data/focus';
import type { Primitive, Vec3 } from '../parametrik/types';
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
		polygon: outline.map(([x, y]) => [x, y]),
		z: outline[0][2],
		height: 0.09 * bay.gauge
	});

	return [
		deck,
		bay.piece(`main-${side}`, flowToken.energy, {
			kind: 'pipe',
			points: [along(bay, side, 0, 0, 0.69), along(bay, side, 1, 0, 0.69)],
			radius: width * bay.gauge
		})
	];
}

/** Straight flight outside the frame, with a riser tapped into the tank supply. */
export function access(bay: Bay, side: number) {
	const base = bay.level === 0 ? 0 : -0.12;
	const stairs = Array.from({ length: 12 }, (_, i) => {
		const corners = [
			[i / 12, -0.18],
			[(i + 1) / 12, -0.18],
			[(i + 1) / 12, 0],
			[i / 12, 0]
		];
		const step = corners.map(([t, s]) =>
			along(bay, side, t, s, base + ((i + 1) * (0.88 - base)) / 12)
		);
		return bay.piece(`tread-${i}`, flowToken.people, {
			kind: 'prism',
			polygon: step.map(([x, y]) => [x, y]),
			z: step[0][2] - 0.08 * bay.gauge,
			height: 0.09 * bay.gauge
		});
	});
	const points: Vec3[] = [
		along(bay, side, 0.16, -0.1, 0),
		along(bay, side, 0.16, -0.1, 0.5),
		along(bay, side, 0.16, 0.5, 0.5)
	];
	return [
		...stairs,
		bay.piece('supply', flowToken.water, { kind: 'pipe', points, radius: 0.14 * bay.gauge })
	];
}
