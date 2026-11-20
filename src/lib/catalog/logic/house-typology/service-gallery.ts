import { inside, validateRing } from '../parametrik/raster/universal/kern';

type XY = [number, number];
type Outline = { polygon: XY[]; holes: XY[][] };
function frontageHit(ring: XY[], x: number, y: number, sign: number) {
	let nearest: { edge: number; point: XY; distance: number } | undefined;
	for (const [i, a] of ring.entries()) {
		const b = ring[(i + 1) % ring.length];
		if (a[0] > x === b[0] > x) continue;
		const at = a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
		const distance = sign * (at - y);
		if (distance > 0 && (!nearest || nearest.distance > distance))
			nearest = { edge: i, point: [x, at], distance };
	}
	return nearest;
}

/** Opens the access shaft to the nearest street-facing wall on a service court. */
export function serviceGallery(shape: Outline, opening: XY[], sign: number): Outline {
	if (!shape.holes.includes(opening) || shape.holes.length !== 1) return shape;
	const xs = opening.map((p) => p[0]),
		ys = opening.map((p) => sign * p[1]);
	const back = sign * Math.min(...ys),
		front = sign * Math.max(...ys);
	const cuts = [Math.min(...xs), Math.max(...xs)].map((x) =>
		frontageHit(shape.polygon, x, front, sign)
	);
	const [left, right] = cuts;
	if (!left || !right || left.edge !== right.edge) return shape;
	const ring = shape.polygon;
	const a = ring[left.edge],
		b = ring[(left.edge + 1) % ring.length];
	const [first, last] = a[0] < b[0] ? [left.point, right.point] : [right.point, left.point];
	const corners: XY[] = [
		[first[0], back],
		[last[0], back]
	];
	if (!corners.every((p) => inside(p, ring))) return shape;
	const polygon = ring.flatMap((p, i) => (i === left.edge ? [p, first, ...corners, last] : [p]));
	try {
		validateRing(polygon);
		return { polygon, holes: [] };
	} catch {
		return shape;
	}
}
