import { flowToken } from '../../data/focus';
import type { Primitive, Vec3 } from '../parametrik/types';
import { along, type Bay } from './megastructure-bay';

/** Walkable strip between two local edge stations, in meters above the floor. */
function deck(bay: Bay, side: number, start: number, end: number, h: number, id: string) {
	const outline = [
		[start, 0],
		[end, 0],
		[end - 0.19, 0.19],
		[start + 0.19, 0.19]
	].map(([t, s]) => along(bay, side, t, s, h));
	return bay.piece(id, flowToken.people, {
		kind: 'prism',
		polygon: outline.map(([x, y]) => [x, y]),
		z: outline[0][2],
		height: 0.09 * bay.gauge
	});
}

/** Perimeter galleries turn through the corners, with the energy main hung beneath. */
export function gallery(bay: Bay, side: number): Primitive[] {
	const main = [along(bay, side, 0, 0, 0.69), along(bay, side, 1, 0, 0.69)];
	return [
		deck(bay, side, 0, 1, 0.88, `gallery-${side}`),
		bay.piece(`main-${side}`, flowToken.energy, {
			kind: 'pipe',
			points: main,
			radius: 0.14 * bay.gauge
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
