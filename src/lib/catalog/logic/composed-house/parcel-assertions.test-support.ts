import { cantileverMargin, footprint, plotCovers, side, type Footprint } from './parcel-footprint';
import assert from 'node:assert/strict';
import { bodyParts } from './provider';
import { bounds, translate } from '../ansicht/geometrie';
import { houseSurfaces } from './surfaces';
import { checkFit, partsIntersect } from '../house-typology';
import { type planHouse, type sectionParts } from './index';

type Section = ReturnType<typeof planHouse>;
type Parts = ReturnType<typeof sectionParts>;
type XY = [number, number];

const epsilon = 1e-9;

function inRing([x, y]: XY, ring: XY[]) {
	let inside = false;
	for (const [i, [a, b]] of ring.entries()) {
		const [u, v] = ring[(i + 1) % ring.length];
		if (b > y !== v > y && x < a + ((u - a) * (y - b)) / (v - b)) inside = !inside;
	}
	return inside;
}
function ringDistance([x, y]: XY, ring: XY[]) {
	let distance = Infinity;
	for (const [i, [u, v]] of ring.entries()) {
		const [a, b] = ring[(i + 1) % ring.length],
			dx = a - u,
			dy = b - v;
		const t = Math.max(0, Math.min(1, ((x - u) * dx + (y - v) * dy) / (dx * dx + dy * dy || 1)));
		distance = Math.min(distance, Math.hypot(x - u - t * dx, y - v - t * dy));
	}
	return distance;
}
function strictlyInside(p: XY, ring: XY[]) {
	return ringDistance(p, ring) > epsilon && inRing(p, ring);
}
// Split at boundary vertices as well as proper intersections. This also catches an edge
// traversing a notch through its two corners, where neither intersection is proper.
function edgeLeaves(a: XY, b: XY, ring: XY[], forbiddenInside: boolean) {
	const cuts = [0, 1],
		dx = b[0] - a[0],
		dy = b[1] - a[1],
		length = Math.hypot(dx, dy);
	if (length <= epsilon) return false;
	for (const [i, c] of ring.entries()) {
		const d = ring[(i + 1) % ring.length];
		const u = side(a, b, c) / length,
			v = side(a, b, d) / length;
		if (Math.abs(u) <= epsilon) cuts.push(((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / length ** 2);
		if (!(u * v < 0)) continue;
		const s = side(c, d, a),
			t = side(c, d, b);
		if (s * t < 0) cuts.push(s / (s - t));
	}
	const ordered = cuts.filter((t) => t >= 0 && t <= 1).sort((s, t) => s - t);
	return ordered.slice(1).some((t, i) => {
		const mid = (t + ordered[i]) / 2,
			p: XY = [a[0] + mid * dx, a[1] + mid * dy];
		return ringDistance(p, ring) > epsilon && inRing(p, ring) === forbiddenInside;
	});
}
function boundaryLeaves(shape: XY[], ring: XY[], forbiddenInside: boolean) {
	return shape.some((p, i) => edgeLeaves(p, shape[(i + 1) % shape.length], ring, forbiddenInside));
}
function encloses(outer: XY[], inner: XY[]) {
	return (
		inner.every((p) => inRing(p, outer) || ringDistance(p, outer) <= epsilon) &&
		!boundaryLeaves(inner, outer, false)
	);
}
function overlaps(a: XY[], b: XY[]) {
	return a.some((p) => strictlyInside(p, b)) || boundaryLeaves(a, b, true);
}
/** Checks occupied footprint edges and opening interiors, allowing contact at their boundaries. */
export function deckCovers(deck: Footprint, shape: Footprint) {
	if (!encloses(deck.ring, shape.ring)) return false;
	return deck.holes.every(
		(hole) =>
			shape.holes.some((opening) => encloses(opening, hole)) ||
			!(overlaps(hole, shape.ring) || overlaps(shape.ring, hole) || encloses(shape.ring, hole))
	);
}
function checkOccupant(
	p: Extract<Parts[number], { structuralRole: 'occupant' }>,
	carrier: Parts[number] | undefined
) {
	if (carrier?.kind !== 'prism' || carrier.structuralRole === 'occupant')
		throw Error('Invalid deck ' + p.carrier);
	const deck = { ring: carrier.polygon as XY[], holes: (carrier.holes ?? []) as XY[][] };
	assert(deckCovers(deck, footprint(p)), p.id + ' outside ' + p.carrier);
}
function bodySeats(s: Section) {
	return s.composition.levels.flatMap((l) =>
		l.bodies.map((b) => ({
			z: b.position[2],
			feet: bodyParts(b, houseSurfaces)
				.filter((p) => Math.abs(bounds(p).min[2] - b.position[2]) < 1e-7)
				.map((p) => translate(p, [0, 0, -0.05]))
		}))
	);
}
function checkSupport(p: Parts[number], ground: number, seats: ReturnType<typeof bodySeats>) {
	if (p.structuralRole === 'bearing') return;
	const box = bounds(p);
	assert(Math.abs(box.min[2] - ground) > 1e-7, p.id + ' rests on the ground');
	for (const seat of seats) {
		if (Math.abs(box.max[2] - seat.z) > 1e-7) continue;
		assert(!seat.feet.some((foot) => partsIntersect(p, foot)), p.id + ' directly supports a body');
	}
}
/** Checks every projected part against its parcel or its named deck. */
export function checkParcel(s: Section, parts: Parts) {
	const carriers = new Map(parts.map((p) => [p.id, p]));
	const seats = bodySeats(s);
	for (const p of parts) {
		checkSupport(p, s.composition.ground, seats);
		if (p.structuralRole === 'occupant') {
			checkOccupant(p, carriers.get(p.carrier));
			continue;
		}
		assert(['bearing', 'cantilever'].includes(p.structuralRole), p.id);
		assert(
			plotCovers(s.cells, footprint(p), p.structuralRole === 'bearing' ? 0 : cantileverMargin),
			p.id + ' ' + p.structuralRole + ' outside ' + s.id
		);
	}
	assert.deepEqual(
		checkFit(s.composition.parts).filter((f) => f.code === 'bearing-role'),
		[]
	);
}
