import assert from 'node:assert/strict';
import { bodyParts } from './provider';
import { bounds, translate } from '../ansicht/geometrie';
import { houseSurfaces } from './surfaces';
import { checkFit, partsIntersect } from '../house-typology';
import { housePartPlan, type planHouse, type sectionParts } from './index';

type Section = ReturnType<typeof planHouse>;
type Parts = ReturnType<typeof sectionParts>;
type XY = [number, number];

type Footprint = { ring: XY[]; holes: XY[][] };

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
/** Convex hull in counter-clockwise order (monotone chain). */
function hull(points: XY[]) {
	const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
	const turn = (o: XY, a: XY, b: XY) =>
		(a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (list: XY[]) => {
		const chain: XY[] = [];
		for (const p of list) {
			while (chain.length > 1 && turn(chain[chain.length - 2], chain[chain.length - 1], p) <= 0)
				chain.pop();
			chain.push(p);
		}
		return chain.slice(0, -1);
	};
	return [...half(sorted), ...half(sorted.reverse())];
}
/** Plan footprint of a part: a prism keeps its own outline and holes, any other kind its hull. */
function footprint(p: Parts[number]): Footprint {
	const plan = housePartPlan(p) as XY[];
	return p.kind === 'prism'
		? { ring: plan, holes: p.holes ?? [] }
		: { ring: hull(plan), holes: [] };
}
/** Samples the whole footprint: its boundary and a grid over its interior, never only vertices. */
function footprintSamples({ ring, holes }: Footprint, finest = 0.9): XY[] {
	const xs = ring.map((p) => p[0]),
		ys = ring.map((p) => p[1]);
	const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
	const step = Math.max(0.1, Math.min(finest, span / 12));
	const samples: XY[] = [];
	for (const [i, [u, v]] of ring.entries()) {
		const [a, b] = ring[(i + 1) % ring.length];
		const n = Math.max(1, Math.ceil(Math.hypot(a - u, b - v) / step));
		for (let k = 0; k < n; k++) samples.push([u + ((a - u) * k) / n, v + ((b - v) * k) / n]);
	}
	for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step)
		for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step)
			if (inRing([x, y], ring) && !holes.some((h) => inRing([x, y], h))) samples.push([x, y]);
	return samples;
}
function cellContains(corners: readonly (readonly number[])[], [x, y]: XY, margin: number) {
	let inside = true,
		distance = Infinity;
	for (const [i, [u, v]] of corners.entries()) {
		const [a, b] = corners[(i + 1) % corners.length],
			dx = a - u,
			dy = b - v;
		if (dx * (y - v) - dy * (x - u) < -1e-9) inside = false;
		const t = Math.max(0, Math.min(1, ((x - u) * dx + (y - v) * dy) / (dx * dx + dy * dy)));
		distance = Math.min(distance, Math.hypot(x - u - t * dx, y - v - t * dy));
	}
	return inside || distance <= margin + 1e-7;
}
/** True when the whole footprint lies on the union of the cells, widened by the margin. */
export function plotCovers(
	cells: readonly { corners: readonly (readonly number[])[] }[],
	shape: Footprint,
	margin: number
) {
	return footprintSamples(shape).every((pt) =>
		cells.some((c) => cellContains(c.corners, pt, margin))
	);
}
/** True when the whole footprint lies on the deck outline and crosses none of its openings. */
export function deckCovers(deck: Footprint, shape: Footprint) {
	return footprintSamples(shape, 0.15).every(
		(pt) =>
			(inRing(pt, deck.ring) || ringDistance(pt, deck.ring) <= 1e-6) &&
			!deck.holes.some((h) => inRing(pt, h) && ringDistance(pt, h) > 1e-6)
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
			plotCovers(s.cells, footprint(p), p.structuralRole === 'bearing' ? 0 : 0.6),
			p.id + ' ' + p.structuralRole + ' outside ' + s.id
		);
	}
	assert.deepEqual(
		checkFit(s.composition.parts).filter((f) => f.code === 'bearing-role'),
		[]
	);
}
