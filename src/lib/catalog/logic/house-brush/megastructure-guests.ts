import { fitScale, footprintPlanes } from '../profile-fit';
import { STORY } from '../../data/grid';
import type { Primitive } from '../parametrik/types';
import type { Bay } from './megastructure-bay';
import type { HouseUse } from './stacks';

function salvage(b: Bay, z: number) {
	const r = b.gauge;
	const panels = Array.from({ length: 3 }, (_, i) =>
		b.piece(`salvage-${i}`, b.token, {
			kind: 'prism',
			polygon: [
				[0.12, 0.16 + i * 0.23],
				[0.96, 0.16 + i * 0.23],
				[0.96, 0.36 + i * 0.23],
				[0.12, 0.36 + i * 0.23]
			].map(([u, v]) => {
				const [x, y] = b.point(u, v, 0);
				return [x, y];
			}),
			z: z - 0.45 * r,
			height: r * (0.7 + i * 0.17)
		})
	);
	return panels;
}

/** Program-specific removable bodies hang from a short central hanger. */
export function guest(
	b: Bay,
	use: HouseUse,
	side: number,
	exposed: boolean,
	lift = 0
): Primitive[] {
	const r = b.gauge;
	const mid = b.point(0.5, 0.18, 0.49);
	mid[2] += lift;
	const raisedTank = exposed && use === 'water';
	if (raisedTank && !lift) mid[2] += STORY * 0.51 + 1.25 * b.radius;
	const hanger = b.piece('hanger', '--paper', {
		kind: 'pipe',
		points: [mid, b.point(0.5, 0.5, 1)],
		radius: r * 0.11
	});
	if (use === 'material') return [hanger, ...salvage(b, mid[2])];
	if (use === 'water' || use === 'food') {
		const span = raisedTank ? b.radius * 0.68 : r * 0.48;
		const squash = use === 'food' ? 0.73 : 1;
		const footprint = [b.point(0, 0, 0), b.point(1, 0, 0), b.point(1, 1, 0), b.point(0, 1, 0)];
		const radius = fitScale(
			footprintPlanes(footprint, mid),
			([nx, ny, nz]) => Math.hypot(nx, ny, nz * squash),
			span
		);
		if (!radius) return [];
		return [
			hanger,
			{
				...b.piece('vessel', b.token, {
					kind: 'sphere',
					position: mid,
					radius,
					squash
				}),
				material: use === 'food' ? 'greenhouse' : 'glaze',
				glass: use === 'food'
			}
		];
	}
	if (use !== 'energy') return [];
	return [
		b.piece('feed', b.token, {
			kind: 'pipe',
			points: [
				b.point(0, 0, lift / STORY),
				b.point(0, 0, 1 + lift / STORY),
				b.point(side % 2, 1, 1 + lift / STORY)
			],
			radius: r * 0.09
		})
	];
}
