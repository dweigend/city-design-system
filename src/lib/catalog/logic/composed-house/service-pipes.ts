import type { Section } from './types';
import type { Vec3 } from '../parametrik/types';
import type { HouseSurfaces } from './surfaces';
import { pipeBetween } from './parts';

/** Connects adjacent tank and dwelling faces with an exposed 0.3 m supply pipe. */
export function servicePipes(section: Section, surfaces: HouseSurfaces) {
	if (section.typology !== 'water-house' || section.composition.compact) return [];
	const sign = section.composition.accessSide === 'north' ? -1 : 1;
	const outlets = section.composition.levels.map((level) => {
		const b = level.bodies[0];
		const length =
			Math.abs(Math.sin(b.rotation)) * b.size[0] + Math.abs(Math.cos(b.rotation)) * b.size[1];
		return [
			b.position[0],
			b.position[1] + (sign * length) / 2,
			b.position[2] + b.size[2] / 2
		] as Vec3;
	});
	return outlets.slice(1).flatMap((end, i) => {
		const start = outlets[i];
		const outside = sign * (Math.max(sign * end[1], sign * start[1]) + 0.15);
		const path: Vec3[] = [
			start,
			[start[0], outside, start[2]],
			[start[0], outside, end[2]],
			[end[0], outside, end[2]],
			end
		];
		return path
			.slice(1)
			.flatMap((p, j) =>
				p.some((v, k) => Math.abs(v - path[j][k]) > 1e-8)
					? [
							pipeBetween(
								section.id + '/service/pipe/' + i + '/' + j,
								path[j],
								p,
								0.15,
								surfaces.frame
							)
						]
					: []
			);
	});
}
