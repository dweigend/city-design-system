import assert from 'node:assert/strict';
import { bodyParts } from './provider';
import { bounds, translate } from '../ansicht/geometrie';
import { houseSurfaces } from './surfaces';
import { checkFit, partsIntersect } from '../house-typology';
import { housePartPlan, type planHouse, type sectionParts } from './index';

type Section = ReturnType<typeof planHouse>;
type Parts = ReturnType<typeof sectionParts>;
type XY = [number, number];

function inRing([x, y]: XY, ring: XY[]) {
	let inside = false;
	for (const [i, [a, b]] of ring.entries()) {
		const [u, v] = ring[(i + 1) % ring.length];
		if (b > y !== v > y && x < a + ((u - a) * (y - b)) / (v - b)) inside = !inside;
	}
	return inside;
}
function checkOccupant(
	p: Extract<Parts[number], { structuralRole: 'occupant' }>,
	carrier: Parts[number] | undefined
) {
	if (carrier?.kind !== 'prism' || carrier.structuralRole === 'occupant')
		throw Error('Invalid deck ' + p.carrier);
	for (const pt of housePartPlan(p))
		assert(
			inRing(pt, carrier.polygon) && !carrier.holes?.some((h) => inRing(pt, h)),
			p.id + ' outside ' + p.carrier
		);
}
function plotContains(s: Section, [x, y]: XY, margin: number) {
	return s.cells.some((c) => {
		let inside = true,
			distance = Infinity;
		for (const [i, [u, v]] of c.corners.entries()) {
			const [a, b] = c.corners[(i + 1) % c.corners.length],
				dx = a - u,
				dy = b - v;
			if (dx * (y - v) - dy * (x - u) < 0) inside = false;
			const t = Math.max(0, Math.min(1, ((x - u) * dx + (y - v) * dy) / (dx * dx + dy * dy)));
			distance = Math.min(distance, Math.hypot(x - u - t * dx, y - v - t * dy));
		}
		return inside || distance <= margin + 1e-7;
	});
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
			housePartPlan(p).every((pt) => plotContains(s, pt, p.structuralRole === 'bearing' ? 0 : 0.6)),
			p.id + ' ' + p.structuralRole + ' outside ' + s.id
		);
	}
	assert.deepEqual(
		checkFit(s.composition.parts).filter((f) => f.code === 'bearing-role'),
		[]
	);
}
