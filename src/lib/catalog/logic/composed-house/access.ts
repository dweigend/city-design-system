import { accessEdge, roofLanding } from './deck-plan';
import type { Vec3 } from '../parametrik/types';
import { fitting, mountFitting } from './asset-fit';
import { slab } from './parts';
import type { Section } from './types';
import type { HouseSurfaces } from './surfaces';

/** Alternating flights meet at the surveyed rear deck edge and finish on the roof walk. */
export function access(s: Section, surfaces: HouseSurfaces) {
	const sign = s.aspect.reverse ? -1 : 1;
	const stops = s.decks.map((d, i): Vec3 => [
		d.position[0] + sign * (i % 2 ? -1 : 1) * d.width * 0.22,
		accessEdge(d),
		d.position[2]
	]);
	const [x, y] = roofLanding(s);
	const z = s.base[2];
	const start: Vec3 = [s.decks[0].position[0] - sign * s.decks[0].width * 0.22, stops[0][1], z];
	stops.push([x + sign * (stops.length % 2 ? -1 : 1) * s.width * 0.22, y, s.top]);
	return stops.flatMap((end, i) => {
		const a = stops[i - 1] ?? start,
			id = s.id + '/stair/' + i;
		const dx = end[0] - a[0],
			dy = end[1] - a[1],
			width = Math.min(1.4, s.depth * 0.15, s.width * 0.15);
		const mount = {
			position: [(a[0] + end[0]) / 2, (a[1] + end[1]) / 2, a[2]] as Vec3,
			size: [Math.hypot(dx, dy), width, end[2] - a[2]] as Vec3,
			angle: Math.atan2(dy, dx)
		};
		const flight = mountFitting(fitting('stairs', id, s.seed, 'deck'), mount, true).map((p) => ({
			...p,
			...surfaces.access
		}));
		return [
			...flight,
			slab(
				id + '/landing',
				[end[0], end[1], end[2] - 0.12],
				width,
				width,
				0.12,
				0.08,
				surfaces.access
			)
		];
	});
}
