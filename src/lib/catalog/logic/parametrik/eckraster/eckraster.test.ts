import { describe, test, expect } from 'bun:test';
import { createPatch, projection, cellAt } from './topology';
import {
	apply,
	edit,
	history,
	restore,
	undo,
	redo,
	initialOccupancy,
	protectedVertex
} from './state';
import { slots, courtyards, spans } from './derive';
import { fixture, gate } from './fixtures';
import { shoelaceArea } from '../raster/geometry';
const p = createPatch();
const put = (o: ReturnType<typeof initialOccupancy>, id: string, h = 0, on = true) =>
	apply(p, o, { vertexId: id, level: h, occupied: on, group: 'test' });
describe('L10 topology and intent', () => {
	test('stable ancestry IDs, incidence, winding and dual projection', () => {
		const other = createPatch(91);
		expect(other.vertices.map((v) => v.id)).toEqual(p.vertices.map((v) => v.id));
		expect(other.faces).toEqual(p.faces);
		expect(new Set(p.vertices.filter((v) => !v.boundary).map((v) => v.faces.length))).toEqual(
			new Set([3, 4, 5])
		);
		for (const f of p.faces) {
			expect(
				shoelaceArea(f.vertices.map((id) => p.vertices.find((v) => v.id === id)!.point))
			).toBeGreaterThan(0);
			for (const id of f.vertices)
				expect(p.vertices.find((v) => v.id === id)!.faces).toContain(f.id);
		}
		for (const c of p.cells) {
			expect(c.area).toBeGreaterThan(0);
			expect(cellAt(p, c.center)).toBe(c.id);
		}
		expect(projection(p, 'slots', 2).cells[0].id).toBe(`${p.faces[0].id}@2`);
	});
	test('projection shares geometry with the patch, as documented', () => {
		const dual = projection(p, 'dual').cells[0];
		expect(dual.polygon).toBe(p.cells[0].polygon);
		expect(dual.center).toBe(p.cells[0].center);
		const points = new Set(p.vertices.map((v) => v.point));
		const slot = projection(p, 'slots').cells[0];
		expect(slot.polygon.every((q) => points.has(q))).toBe(true);
	});
	test('all eight bit positions and fixed free cap', () => {
		const f = p.faces.find((f) => !f.vertices.includes(protectedVertex(p)))!;
		for (let bit = 0; bit < 8; bit++) {
			const o = put({}, f.vertices[bit % 4], Math.floor(bit / 4));
			expect(slots(p, o).find((s) => s.id === `${f.id}@0`)!.mask).toBe(2 ** bit);
		}
		const o = put({}, f.vertices[0], 2);
		expect(slots(p, o).find((s) => s.id === `${f.id}@2`)!.mask).toBe(1);
	});
	test('U → courtyard → U, roof invalidates garden', () => {
		const u = fixture(p, 'hof');
		// Between ring and perimeter block lies a small back courtyard; the large courtyard is still missing.
		const base = courtyards(p, u).size;
		expect(courtyards(p, u).has('origin')).toBe(false);
		const closed = put(u, gate(p));
		expect(courtyards(p, closed).has('origin')).toBe(true);
		expect(courtyards(p, put(closed, gate(p), 0, false)).size).toBe(base);
		expect(courtyards(p, put(closed, 'origin', 1)).size).toBe(base);
	});
	test('bridge needs two grounded abutments', () => {
		const o = fixture(p, 'hochweg');
		expect(spans(p, o, 0).size).toBeGreaterThan(0);
		expect(spans(p, put(o, 'origin', 0, false), 0).size).toBe(0);
		expect(slots(p, o).some((s) => s.context.span)).toBe(true);
	});
	test('intent replay, undo/redo, branch truncation and protection', () => {
		let h = history(initialOccupancy(p));
		const initial = restore(p, h);
		h = edit(p, h, { vertexId: 'origin', level: 0, occupied: true, group: 'a' });
		const changed = restore(p, h);
		expect(restore(p, undo(h))).toEqual(initial);
		expect(restore(p, redo(undo(h)))).toEqual(changed);
		const branch = edit(p, undo(h), { vertexId: 'origin', level: 2, occupied: true, group: 'b' });
		expect(redo(branch)).toEqual(branch);
		expect(put(initial, protectedVertex(p), 0, false)).toEqual(initial);
	});
	test('same seed and end occupancy yields identical slots independent of edit order', () => {
		const a = put(put({}, 'origin'), gate(p), 1),
			b = put(put({}, gate(p), 1), 'origin');
		expect(slots(p, a)).toEqual(slots(createPatch(), b));
	});
});

test('protected body is unchanged by additions, removals and scene selection', async () => {
	const { presentation, placeholder } = await import('./presentation');
	const { eckModul } = await import('../formen/eck');
	const body = (o: ReturnType<typeof initialOccupancy>) =>
		presentation(p, o, slots(p, o), eckModul, false, false).filter(
			(x) => x.kind === 'prism' && x.role === 'bestand' && !x.id.startsWith('bestand:')
		);
	const original = body(initialOccupancy(p));
	expect(original.length).toBeGreaterThan(10);
	for (const name of ['huelle', 'hochweg', 'hof', 'quartier', 'hochweg-turm'] as const)
		expect(body(fixture(p, name))).toEqual(original);
	expect(body(put(fixture(p, 'hochweg'), 'origin', 0, false))).toEqual(original);
	expect(presentation(p, {}, slots(p, {}), placeholder, false, false).length).toBe(1);
});
test('dual cells cover the primal domain and neighbor-filled follows shared sides', () => {
	const primalArea = p.faces.reduce(
		(sum, f) =>
			sum + shoelaceArea(f.vertices.map((id) => p.vertices.find((v) => v.id === id)!.point)),
		0
	);
	expect(p.cells.reduce((sum, c) => sum + c.area, 0)).toBeCloseTo(primalArea, 8);
	const all = slots(p, fixture(p, 'huelle'));
	for (const s of all) {
		const [faceId, h] = s.id.split('@'),
			f = p.faces.find((f) => f.id === faceId)!;
		expect<readonly boolean[]>(s.context.neighborFilled).toEqual(
			f.neighbors.map((id) => id !== null && all.find((x) => x.id === `${id}@${h}`)!.mask !== 0)
		);
	}
});

test('integrated eckModul geometry is deterministic for the same final occupancy', async () => {
	const { eckModul } = await import('../formen/eck');
	const { presentation } = await import('./presentation');
	const a = put(put({}, 'origin'), gate(p), 1),
		b = put(put({}, gate(p), 1), 'origin');
	expect(presentation(p, a, slots(p, a), eckModul, false, false)).toEqual(
		presentation(p, b, slots(p, b), eckModul, false, false)
	);
	for (const name of ['huelle', 'hochweg', 'hof'] as const) {
		const o = fixture(p, name);
		expect(slots(p, o).flatMap(eckModul).length).toBeGreaterThan(0);
	}
});

describe('Round 1: floors, color, crowns, columns, courtyards, decks', async () => {
	const { eckModul, DECK } = await import('../formen/eck');
	const { presentation } = await import('./presentation');
	const { heads } = await import('./koepfe');
	const { decks } = await import('./derive');
	const { courtRing } = await import('./fixtures');
	const solids = (o: ReturnType<typeof initialOccupancy>) =>
		slots(p, o)
			.flatMap(eckModul)
			.filter((x) => x.kind === 'prism');
	test('one story = one full HEIGHT_STEP, standing on the ground', () => {
		const out = solids(put({}, 'origin'));
		const bodies = out.filter((x) => x.kind === 'prism' && x.height > 1);
		expect(Math.min(...bodies.map((x) => (x.kind === 'prism' ? x.z : 0)))).toBeCloseTo(0, 6);
		expect(Math.max(...bodies.map((x) => (x.kind === 'prism' ? x.z + x.height : 0)))).toBeCloseTo(
			4,
			6
		);
		expect(slots(p, {}).some((s) => s.id.endsWith('@-1') && s.context.ground)).toBe(true);
	});
	test('color follows the function, ink without one', () => {
		const water = apply(p, {}, { vertexId: 'origin', level: 0, occupied: true, group: 'wasser' });
		expect(solids(water).every((x) => x.token === '--cat-health')).toBe(true);
		const ink = apply(p, {}, { vertexId: 'origin', level: 0, occupied: true, group: 'eingriff' });
		expect(solids(ink).every((x) => x.token === '--paper' && x.role === 'neu')).toBe(true);
		const both = apply(p, water, {
			vertexId: gate(p),
			level: 0,
			occupied: true,
			group: 'energie'
		});
		expect(new Set(solids(both).map((x) => x.token))).toEqual(
			new Set(['--cat-health', '--cat-mobility'])
		);
	});
	test('one head per connected intervention, on its highest point', () => {
		let o = {} as ReturnType<typeof initialOccupancy>;
		for (const h of [0, 1, 2]) o = put(o, 'origin', h);
		const next = p.vertices.find((v) => v.id === 'origin')!.neighbors[0];
		o = put(put(o, next, 0), next, 1);
		expect(heads(p, o)).toEqual([expect.objectContaining({ vertexId: 'origin', level: 2 })]);
		expect(heads(p, put({}, 'origin'))).toEqual([]);
		const other = apply(p, o, { vertexId: 'rim2', level: 1, occupied: true, group: 'wasser' });
		expect(
			heads(
				p,
				apply(p, other, { ...{ vertexId: 'rim2', level: 0, group: 'wasser' }, occupied: true })
			).length
		).toBe(2);
	});
	test('stilts reach the next solid below on every level', () => {
		const stilts = (o: ReturnType<typeof initialOccupancy>) =>
			slots(p, o).flatMap((s) => s.context.stilts ?? []);
		expect(stilts(put({}, 'origin', 2))).toEqual([expect.objectContaining({ from: 0 })]);
		expect(stilts(put(put({}, 'origin', 0), 'origin', 2))).toEqual([
			expect.objectContaining({ from: 4 })
		]);
		const out = slots(p, put({}, 'origin', 2)).flatMap(eckModul);
		expect(out.filter((x) => x.kind === 'cylinder' && x.height > 7.9).length).toBe(1);
	});
	test('large courtyards get gardens over every enclosed cell', () => {
		const o = put(fixture(p, 'hof'), gate(p));
		expect(courtRing(p).length).toBe(20);
		expect(courtyards(p, o).size - courtyards(p, fixture(p, 'hof')).size).toBe(6);
		const gardens = presentation(p, o, slots(p, o), eckModul, false, false).filter((x) =>
			x.id.startsWith('garden:')
		);
		expect(new Set(gardens.map((x) => x.id.slice(7, x.id.lastIndexOf('@')))).size).toBe(
			courtyards(p, o).size
		);
		expect(gardens.some((x) => x.kind === 'sphere' || x.kind === 'cone')).toBe(true);
	});
	test('a deck stays open under an occupied level, the body above stands on posts', () => {
		const base = fixture(p, 'hochweg');
		const deck = [...decks(p, base).get(1)!][0];
		const o = put(base, deck, 2);
		expect(decks(p, o).get(1)!.has(deck)).toBe(true);
		const s = slots(p, o);
		expect(s.flatMap((x) => x.context.stilts ?? [])).toContainEqual(
			expect.objectContaining({ from: 4 + DECK })
		);
		// The deck's upper half carries no body: the lower deck bit is clear space.
		const own = s.filter((x) => x.id.endsWith('@1') && (x.context.deck ?? 0) & 15);
		expect(own.length).toBeGreaterThan(0);
		for (const x of own) {
			const bits = (x.context.deck ?? 0) & 15;
			const body = eckModul({
				...x,
				mask: x.mask & bits,
				context: { ...x.context, role: 'neu' }
			}).filter((q) => q.kind === 'prism');
			expect(body.length).toBe(0);
		}
	});
	test('heads, gardens and stilts are deterministic for every scene', () => {
		for (const f of [
			'huelle',
			'hochweg',
			'hof',
			'quartier',
			'aufstockung',
			'geruestturm',
			'hochweg-turm'
		] as const) {
			const o = fixture(p, f);
			const a = presentation(p, o, slots(p, o), eckModul, true, true);
			expect(a).toEqual(presentation(p, o, slots(p, o), eckModul, true, true));
			expect(JSON.stringify(a).includes('null')).toBe(false);
		}
		expect(heads(p, fixture(p, 'quartier')).length).toBeGreaterThan(3);
	});
});
