import { expect, test } from 'bun:test';
import { bounds } from '../ansicht/geometrie';
import { circulation, housePartPlan, houseSurfaces, sectionParts } from '../composed-house';
import { specimen } from './specimens';
import { typologies, type Typology } from './families';

type Part = ReturnType<typeof sectionParts>[number];
type XY = [number, number];
function edgeDistance(a: XY, b: XY, p: XY) {
	const dx = b[0] - a[0],
		dy = b[1] - a[1];
	const t = Math.max(
		0,
		Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))
	);
	return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function touches(a: Part, b: Part) {
	const A = bounds(a),
		B = bounds(b);
	if (A.min.some((v, k) => v > B.max[k] + 0.02 || B.min[k] > A.max[k] + 0.02)) return false;
	const one = housePartPlan(a),
		two = housePartPlan(b);
	const near = (a: XY[], b: XY[]) =>
		a.some((p, i) => b.some((q) => edgeDistance(p, a[(i + 1) % a.length], q) < 0.020001));
	return near(one, two) || near(two, one);
}
function inside(point: XY, ring: XY[]) {
	const [x, y] = point;
	const crossings = ring.filter(([a, b], i) => {
		const [c, d] = ring[(i + 1) % ring.length];
		return b > y !== d > y && x < a + ((c - a) * (y - b)) / (d - b);
	});
	return crossings.length % 2 === 1;
}
function onDeck(point: XY, deck: Extract<Part, { kind: 'prism' }>) {
	const rings = [deck.polygon, ...(deck.holes ?? [])];
	if (
		rings.some((r) => r.some((a, i) => edgeDistance(a, r[(i + 1) % r.length], point) <= 0.020001))
	)
		return true;
	return inside(point, deck.polygon) && !(deck.holes ?? []).some((h) => inside(point, h));
}
test('every floor and roof exit meets its physical deck within two centimetres', () => {
	for (const type of [
		'deck-tower',
		'rack',
		'cluster-mast',
		'terrace-house',
		'plinth-house',
		'round-tower',
		'courtyard-house',
		'water-house',
		'tree-house',
		'portal-house',
		'lattice-head',
		'slab-house',
		'bridge-house',
		'twin-stack',
		'capsule-stack',
		'bell-house'
	] as const) {
		const cells =
			type === 'courtyard-house'
				? 4
				: ['terrace-house', 'portal-house', 'twin-stack', 'bridge-house', 'slab-house'].includes(
							type
					  )
					? 2
					: 1;
		const s = specimen(cells, type),
			floors = sectionParts(s).filter((p) => p.kind === 'prism' && p.roofCell !== undefined);
		for (const {
			door: [x, y, z]
		} of circulation(s).docks)
			expect(
				floors.some(
					(p) => p.kind === 'prism' && Math.abs(p.z + p.height - z) <= 0.02 && onDeck([x, y], p)
				),
				type + ' at ' + z
			).toBe(true);
	}
});
test('switchback half-landings meet a building member, directly or through an attached deck seat', () => {
	for (const type of ['deck-tower', 'rack', 'cluster-mast', 'plinth-house'] as const) {
		const parts = sectionParts(specimen(1, type));
		const building = parts.filter(
			(p) =>
				!p.id.includes('/stair/') && !p.id.includes('/landing-seat/') && !p.id.includes('/people/')
		);
		const track = parts.filter((p) => p.id.endsWith('/tread')).flatMap(housePartPlan);
		const envelope = building.flatMap(housePartPlan);
		for (const axis of [0, 1] as const) {
			const coords = (points: XY[]) => points.map((p) => p[axis]);
			expect(Math.min(...coords(track))).toBeLessThanOrEqual(Math.max(...coords(envelope)) + 0.02);
			expect(Math.max(...coords(track))).toBeGreaterThanOrEqual(
				Math.min(...coords(envelope)) - 0.02
			);
		}
		const turns = parts.filter((p) => p.id.includes('/stair/') && p.id.endsWith('/landing'));
		expect(turns.length).toBeGreaterThan(0);
		for (const turn of turns) {
			const seat = parts.find((p) => p.id === turn.id.replace('/stair/', '/landing-seat/'));
			expect(
				building.some((b) => touches(turn, b)) ||
					(!!seat && touches(turn, seat) && building.some((b) => touches(seat, b))),
				turn.id + ' ' + type
			).toBe(true);
		}
	}
});
test('a thirteen-storey frame carries loads through lattice bays with 0.3 m chords and diagonals', () => {
	for (const type of ['deck-tower', 'capsule-stack', 'rack'] as const) {
		const h = specimen(1, type, 13).composition;
		expect(h.signature.support).toBe('lattice shaft');
		const braces = h.supports.filter((p) => p.id.includes('/lattice/'));
		expect(braces.length).toBeGreaterThan(3);
		for (const b of braces) {
			expect(b.size[1]).toBeCloseTo(0.3);
			expect(b.size[2]).toBeLessThanOrEqual(4.000001);
		}
	}
});
test('four-cell housing exposes programme stock and an open bay, terrace or courtyard', () => {
	const uses = new Set(
		['living', 'food', 'water', 'material', 'energy'].map(
			(k) => houseSurfaces[k as keyof typeof houseSurfaces].token
		)
	);
	for (const type of [
		'plinth-house',
		'terrace-house',
		'courtyard-house',
		'round-tower',
		'rack',
		'bell-house'
	] as Typology[]) {
		const s = specimen(4, type),
			h = s.composition,
			parts = sectionParts(s);
		for (const level of h.levels)
			expect(
				level.bodies.some((b) =>
					parts.some(
						(p) =>
							p.id.startsWith(b.id + '/' + b.objectId + '/') &&
							(uses.has(p.token) || (b.band?.shell && p.token === houseSurfaces.shell.token))
					)
				),
				type
			).toBe(true);
		const open = h.levels.some(
			(l) =>
				l.court ||
				l.well ||
				l.void ||
				l.field ||
				l.width * l.depth < h.bay.width * h.bay.depth * 0.75
		);
		expect(open, type).toBe(true);
	}
});

test('registry groups have unscaled feet on terraces, landings or roofs', () => {
	for (const type of typologies) {
		const s = specimen(type === 'courtyard-house' ? 4 : 2, type),
			parts = sectionParts(s);
		const floors = parts.filter(
			(p): p is Extract<Part, { kind: 'prism' }> =>
				p.kind === 'prism' && (p.roofCell !== undefined || p.id.endsWith('/landing'))
		);
		const groups = Map.groupBy(
			parts.filter((p) => p.source.objectId.startsWith('person-')),
			(p) => p.id.split('/person-')[0]
		);
		expect(groups.size, type).toBeGreaterThanOrEqual(3);
		expect(groups.size, type).toBeLessThanOrEqual(15);
		for (const [id, figure] of groups) {
			const feet = figure.map(bounds).sort((a, b) => a.min[2] - b.min[2])[0];
			const point: XY = [(feet.min[0] + feet.max[0]) / 2, (feet.min[1] + feet.max[1]) / 2];
			expect(
				floors.some((p) => Math.abs(feet.min[2] - p.z - p.height) < 0.02 && onDeck(point, p)),
				type + ' ' + id
			).toBe(true);
		}
	}
});
test('each band has a terrace guard and a recessed pane below its lintel', () => {
	for (const type of typologies) {
		const s = specimen(type === 'courtyard-house' ? 4 : 2, type),
			parts = sectionParts(s);
		for (const b of s.slots.filter((b) => b.band)) {
			const courses = parts.filter((p) => p.id.startsWith(b.id + '/primitive-slab/'));
			const pane = courses.find((p) => p.id.includes('/window')),
				sill = courses.find((p) => p.id.includes('/sill'));
			if (!pane || !sill) throw Error('Missing glazing or sill');
			for (const axis of [0, 1])
				expect(bounds(pane).min[axis] - bounds(sill).min[axis]).toBeCloseTo(0.15);
			expect(parts.some((p) => p.id.startsWith(b.id + '/terrace/kit-parapet-solid-'))).toBe(true);
		}
	}
});
