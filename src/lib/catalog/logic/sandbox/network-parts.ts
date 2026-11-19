import { hashUnit } from '../../core/random';
import { houseSurfaces, person } from '../composed-house';
import { finishMaterial } from '../material/surface';
import { interpolatePoint, type Primitive } from '../parametrik/types';
import type { Network } from '../walkway-network';

function residents(network: Network, id: string, seed: number) {
	const count = Math.max(1, Math.round(network.length / 10));
	const result: Primitive[] = [];
	let distance = 0,
		index = 0;
	const strips = network.geometry.filter((p) => p.kind === 'mesh');
	const station = () => ((index + 0.25 + 0.5 * hashUnit(seed, id, index)) * network.length) / count;
	for (const sheet of strips) {
		const [a, b, c, d] = sheet.points;
		const from = interpolatePoint(a, b, 0.5),
			to = interpolatePoint(c, d, 0.5);
		const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
		while (index < count && station() <= distance + length) {
			// The shared triangle diagonal lies exactly on the visible wearing surface.
			const feet = interpolatePoint(sheet.points[0], sheet.points[2], 0.5);
			result.push(
				...person(
					feet,
					id + '/people/' + index,
					seed,
					houseSurfaces,
					Math.atan2(to[1] - from[1], to[0] - from[0])
				)
			);
			index++;
		}
		distance += length;
	}
	return result;
}

/** Dresses the planner's named surfaces and seats registry figures along the public tree. */
export function networkParts(network: Network, id: string, seed: number): Primitive[] {
	const deck = network.geometry.map(({ slot, ...shape }) => {
		const surface = houseSurfaces[slot];
		return {
			...shape,
			id: id + '/' + shape.id,
			...surface,
			material: finishMaterial(surface.finish)
		};
	});
	return [...deck, ...residents(network, id, seed)];
}
