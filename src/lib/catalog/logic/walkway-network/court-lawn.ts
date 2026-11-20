import { roundFootprint } from '../building-envelope';
import type { Primitive, Vec3 } from '../parametrik/types';
import { perimeterHull } from '../parametrik/perimeter-hull';
import { ribbonProfile } from './ribbon-column';
import type { Point2 } from '../parametrik/vocab';
import { courtSurfaces } from './town-palette';

type Plate = Extract<Primitive, { kind: 'prism' }>;

function slopingEdge(plate: Plate, outer: Point2[], inner: Point2[], lipBase: number): Primitive {
	const points: Vec3[] = [];
	const triangles: number[] = [];
	for (const [i, [x, y]] of outer.entries()) {
		points.push([...inner[i], plate.z], [x, y, lipBase]);
		const base = 2 * i;
		const next = 2 * ((i + 1) % outer.length);
		triangles.push(base, next, next + 1, base, next + 1, base + 1);
	}
	return {
		kind: 'mesh',
		id: plate.id + '/bank',
		...courtSurfaces.lawn,
		edges: false,
		smooth: true,
		points,
		triangles,
		lines: []
	};
}

function landingEdge({ landing: [x, y], heading }: { landing: Vec3; heading: number }): Point2[] {
	return [-0.5, 0.5].map((side) => [
		x - side * ribbonProfile.width * Math.sin(heading),
		y + side * ribbonProfile.width * Math.cos(heading)
	]);
}

/** Rounds the finished court perimeter and carries the flush lawn on a bevelled turf bank. */
export function courtLawn(
	plate: Primitive,
	mouth?: { landing: Vec3; heading: number }
): Primitive[] {
	if (plate.kind !== 'prism' || !/^court\/\d+\/\d+$/.test(plate.id) || plate.polygon.length !== 4)
		return [plate];
	const ring = plate.polygon;
	const x = ring.reduce((sum, p) => sum + p[0], 0) / 4,
		y = ring.reduce((sum, p) => sum + p[1], 0) / 4;
	const width = Math.min(
		...ring.map(([x, y], i) => Math.hypot(x - ring[(i + 1) % 4][0], y - ring[(i + 1) % 4][1]))
	);
	const rounded = roundFootprint(ring, Math.min(5.5, width * 0.32));
	const outer = mouth ? perimeterHull([...rounded, ...landingEdge(mouth)]) : rounded;
	const lawn = outer.map(([a, b]): Point2 => [a + (x - a) * 0.023, b + (y - b) * 0.023]);
	const lipHeight = Math.min(0.1, plate.height);
	const lipBase = plate.z + plate.height - lipHeight;
	return [
		{ ...plate, polygon: outer, holes: [lawn], edges: false, z: lipBase, height: lipHeight },
		slopingEdge(plate, outer, lawn, lipBase),
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
