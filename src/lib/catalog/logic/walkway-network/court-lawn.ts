import { roundFootprint } from '../building-envelope';
import type { Primitive } from '../parametrik/types';
import { courtSurfaces } from './town-palette';

/** Inserts a flush, rounded lawn into the finished court paving. A single narrow
 * stone rim retains its original straight contacts with entrances and garden beds. */
export function courtLawn(plate: Primitive): Primitive[] {
	if (plate.kind !== 'prism' || !/^court\/\d+\/\d+$/.test(plate.id) || plate.polygon.length !== 4)
		return [plate];
	const ring = plate.polygon;
	const x = ring.reduce((sum, p) => sum + p[0], 0) / 4,
		y = ring.reduce((sum, p) => sum + p[1], 0) / 4;
	const width = Math.min(
		...ring.map(([x, y], i) => Math.hypot(x - ring[(i + 1) % 4][0], y - ring[(i + 1) % 4][1]))
	);
	const lawn = roundFootprint(
		ring.map(([a, b]) => [a + (x - a) * 0.023, b + (y - b) * 0.023]),
		Math.min(5.5, width * 0.32)
	);
	return [
		{ ...plate, holes: [lawn], edges: false },
		{
			kind: 'prism',
			id: 'court-lawn/' + plate.id.slice(6),
			...courtSurfaces.lawn,
			edges: false,
			polygon: lawn,
			z: plate.z,
			height: plate.height
		}
	];
}
