import { expect, test } from 'bun:test';
import { defineRules, type NeighbourCell } from './index';
import { districtFrame, frameRules } from '../district-frame';
import { squareGrid } from '../quad-grid';

const forms = ['grove', 'house', 'open', 'path'];
const contacts = Object.fromEntries(forms.map((form) => [form, forms]));
const cell = (id: string, neighbour: string, form = 'open'): NeighbourCell => ({
	id,
	district: 'valley',
	neighbors: [null, neighbour, null],
	form
});
const pair = (a: NeighbourCell, b: NeighbourCell) =>
	new Map([
		[a.id, a],
		[b.id, b]
	]);

test('an occupied neighbour vetoes the grove preferred by its district', () => {
	const rules = defineRules({
		contacts: { ...contacts, grove: ['open', 'grove'] },
		city: { house: 0, path: 0 },
		districts: { valley: { grove: 10 } }
	});
	const state = pair(cell('a', 'b'), { ...cell('b', 'a', 'house'), protected: true });
	expect(rules.explain('a', state, 7).target).toBe('open');
	expect(rules.explain('a', state, 7).vetoes).toContainEqual({
		form: 'grove',
		reason: 'contact',
		neighbour: 'b'
	});
});

test('city exclusions outrank district weights and a player request', () => {
	const rules = defineRules({
		contacts,
		city: { path: 0 },
		districts: { valley: { open: 0, house: 0 } }
	});
	const state = pair({ ...cell('a', 'b'), intent: 'path' }, cell('b', 'a'));
	const decision = rules.explain('a', state, 7);
	expect(decision.target).toBe('grove');
	expect(decision.vetoes).toContainEqual({ form: 'path', reason: 'city' });
});

test('two ticks mature intent while existing stock keeps its identity', () => {
	const rules = defineRules({ contacts }, { delay: 2 });
	const house = { ...cell('b', 'a', 'house'), protected: true, intent: 'grove' };
	const state = pair({ ...cell('a', 'b'), intent: 'grove' }, house);
	const first = rules.tick(['a', 'b'], state, 7);
	expect(first.get('a')?.pending).toEqual({ form: 'grove', ticks: 1 });
	expect(first.has('b')).toBe(false);
	const next = new Map([...state, ...first]);
	expect(next.get('b')).toBe(house);
	expect(rules.tick(['a', 'b'], next, 7).get('a')?.form).toBe('grove');
});

test('a vocabulary larger than the budget holds before the first candidate', () => {
	const rules = defineRules({ contacts: { open: [], house: [], grove: [] } }, { budget: 1 });
	const state = pair(cell('a', 'b'), cell('b', 'a'));
	expect(rules.explain('a', state, 7)).toMatchObject({
		target: 'open',
		reason: 'budget',
		evaluated: 0
	});
});

test('disconnected district and court sides stay open along an isolated strip', () => {
	const grid = squareGrid(6, 1, 5);
	const state = new Map(
		grid.cells.map((c, i) => [
			c.id,
			{
				...c,
				district: i === 0 ? 'ridge' : 'valley',
				form: 'house',
				protected: i !== 2,
				intent: 'court'
			}
		])
	);
	const next = new Map<string, NeighbourCell>([
		...state,
		...frameRules({}, { delay: 1 }).tick(state.keys(), state, 7)
	]);
	const edges = districtFrame(next.keys(), next, grid.cellsById, new Set(['["5/0","5/1"]']));
	expect(edges.map((edge) => edge.role)).toEqual(['gap', 'gap', 'gap', 'gap', 'gap']);
	expect(edges.map((edge) => edge.vertices[0])).toEqual(['1/0', '2/0', '3/0', '4/0', '5/0']);
});

import { compileSeams, type FrameSeam } from '../district-frame';

function court(id: string, a: string, b: string): FrameSeam {
	return {
		id,
		vertices: [a, b],
		houses: [id],
		district: 'd',
		character: 'core',
		use: 'court',
		districtEdge: false,
		intent: 'main'
	};
}
const entrance = { ...court('entry', 'a', 'b'), opening: 'square-access', blocker: 'path' };

test('court run ends at both entry jambs', () => {
	const ring = [
		entrance,
		court('east', 'b', 'c'),
		court('north', 'c', 'd'),
		court('west', 'd', 'a')
	];
	const roles = compileSeams(ring).solve(
		ring.map((s) => s.id),
		new Map(),
		7
	);
	expect([...roles.values()].filter((d) => d.role === 'main')).toHaveLength(3);
	expect(roles.get('entry')?.reason).toBe('square-access');
});

test('transverse gate requires a promenade or main alley', () => {
	for (const transverse of ['alley', 'riversidePromenade', 'mainAlley'] as const) {
		const gate = { ...court('gate', 'a', 'b'), gate: true, transverse };
		const result = compileSeams([gate, court('run', 'b', 'c')]).explain('gate', new Map(), 7);
		expect(result.role).toBe(transverse === 'alley' ? 'gap' : 'main');
	}
});

test('a third spur cannot be supported by two secondary neighbours', () => {
	const chain = Array.from({ length: 4 }, (_, i) => ({
		...court(String(i), String(i), String(i + 1)),
		use: 'houses' as const,
		intent: 'secondary' as const,
		attachment: true
	}));
	const stock = new Map([
		['0', { built: 'main' as const }],
		['1', { built: 'secondary' as const }],
		['2', { built: 'secondary' as const }]
	]);
	expect(compileSeams(chain).explain('3', stock, 11).reason).toBe('detached-spur');
});

test('a blocked intervention names the opening and keeps its built section', () => {
	const pack = compileSeams([entrance]);
	const stock = new Map([['entry', { built: 'secondary' as const, builtTick: 1 }]]);
	expect(pack.explain('entry', stock, 7)).toMatchObject({
		role: 'secondary',
		reason: 'square-access',
		blocker: 'path'
	});
	expect(pack.tick(['entry'], stock, 7, 3).size).toBe(0);
});

test('stale district preferences retain the base draw and explain the revision mismatch', () => {
	const state = pair(cell('a', 'b'), cell('b', 'a'));
	const revision = { snapshotRevision: '2', profileRevision: 'p' };
	const rules = defineRules({
		contacts,
		revision,
		preferenceSnapshot: {
			...revision,
			snapshotRevision: '1',
			preferences: { valley: { formMultipliers: { grove: 1000 } } }
		}
	});
	expect(rules.explain('a', state, 7).target).toBe(
		defineRules({ contacts }).explain('a', state, 7).target
	);
	expect(rules.explain('a', state, 7).preferenceStatus).toBe('stale');
});
