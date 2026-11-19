// @ts-expect-error Bun provides its test API at runtime.
import { expect, test } from 'bun:test';
import { required } from '../required';
import { affectedRegion, defineRules, type NeighbourCell, type Snapshot } from './index';

const forms = ['open', 'grove', 'house'];
const contacts = { open: forms, grove: ['grove', 'open'], house: ['house', 'open'] };
const rules = defineRules({ contacts }, { delay: 1 });
function strip(length: number) {
	const cells = new Map<string, NeighbourCell>();
	for (let i = 0; i < length; i++) {
		const id = String(i);
		const neighbors = [i ? String(i - 1) : null, i + 1 < length ? String(i + 1) : null, null];
		for (let side = 0; side < i % 3; side++) neighbors.push(null);
		cells.set(id, { id, district: 'ridge', neighbors, form: 'open', protected: i % 7 === 0 });
	}
	return cells;
}

test('64 seeds on mixed 3–5 sided parcels preserve reciprocal contacts, stock and permutation invariance', () => {
	const original = strip(31);
	const reversed = new Map([...original].reverse());
	for (let seed = 0; seed < 64; seed++) {
		let state: Snapshot = original;
		expect(rules.solve(reversed.keys(), reversed, seed)).toEqual(
			rules.solve(original.keys(), original, seed)
		);
		for (let t = 0; t < 3; t++) {
			const next = new Map([...state, ...rules.tick(state.keys(), state, seed)]);
			checkContacts(next, original);
			state = next;
		}
	}
});

test('a local intent edit restricts reads and reproduces full decisions and tick patches', () => {
	const original = strip(51);
	const edited = new Map(original);
	edited.set('25', { ...required(original.get('25'), 'fixture cell'), intent: 'grove' });
	const region = affectedRegion(['25'], original, edited);
	expect(region).toEqual(['23', '24', '25', '26', '27']);
	const halo = new Map([...edited].filter(([id]) => Number(id) >= 21 && Number(id) <= 29));
	for (let seed = 0; seed < 32; seed++) {
		const before = rules.solve(original.keys(), original, seed);
		const after = rules.solve(edited.keys(), edited, seed);
		expect(new Map([...before, ...rules.solve(region, halo, seed)])).toEqual(after);
		const full = rules.tick(edited.keys(), edited, seed);
		expect(rules.tick(region, halo, seed)).toEqual(
			new Map([...full].filter(([id]) => region.includes(id)))
		);
	}
});

test('regrid closure reads retired and inserted incidences and emits only surviving IDs', () => {
	const before = strip(13);
	const after = new Map(before);
	const old = required(before.get('6'), 'fixture cell');
	after.delete('6');
	after.set('new', { ...old, id: 'new' });
	for (const id of ['5', '7']) {
		const cell = required(before.get(id), 'fixture cell');
		after.set(id, { ...cell, neighbors: cell.neighbors.map((n) => (n === '6' ? 'new' : n)) });
	}
	const closure = affectedRegion(['6', 'new'], before, after);
	expect(closure).toEqual(['4', '5', '7', '8', 'new']);
	const cached = rules.solve(before.keys(), before, 11);
	cached.delete('6');
	expect(new Map([...cached, ...rules.solve(closure, after, 11)])).toEqual(
		rules.solve(after.keys(), after, 11)
	);
});

test('conflicting neighbours resolve by ID even when only the losing cell is queried', () => {
	const state = strip(2);
	state.set('0', {
		...required(state.get('0'), 'fixture cell'),
		intent: 'house',
		protected: false
	});
	state.set('1', { ...required(state.get('1'), 'fixture cell'), intent: 'grove' });
	expect(rules.explain('1', state, 9)).toMatchObject({
		reason: 'conflict',
		blocker: '0',
		target: 'open'
	});
	expect(rules.tick(state.keys(), state, 9).get('0')?.form).toBe('house');
	expect(rules.tick(['1'], state, 9).size).toBe(0);
});

test('growth follows a source by one side per tick, and an edited intent resets elapsed time', () => {
	const grow = defineRules(
		{ contacts, sources: { grove: ['grove'] }, city: { house: 0 } },
		{ delay: 2 }
	);
	const state = strip(4);
	for (const [id, cell] of state)
		state.set(id, { ...cell, form: id === '0' ? 'grove' : 'open', intent: 'grove' });
	const step = (s: Snapshot) => new Map([...s, ...grow.tick(s.keys(), s, 1)]);
	const first = step(state);
	expect(first.get('2')).toBe(state.get('2'));
	const redirected = new Map(first);
	redirected.set('1', { ...required(first.get('1'), 'fixture cell'), intent: 'open' });
	expect(step(redirected).get('1')?.pending).toBeUndefined();
	const second = step(first);
	expect(second.get('1')?.form).toBe('grove');
	expect(step(second).get('2')?.pending).toEqual({ form: 'grove', ticks: 1 });
});

test('budget exhaustion and contradictory zoning hold stock across seeds and side counts', () => {
	const state = strip(10);
	for (const budget of [0, 1, 2, 3]) {
		const limited = defineRules({ contacts, city: { house: 0, grove: 0, open: 0 } }, { budget });
		for (const choice of limited.solve(state.keys(), state, 0).values()) {
			expect(choice.evaluated).toBeLessThanOrEqual(budget);
			expect(choice.target).toBe('open');
			expect(['stock', budget === 3 ? 'empty-domain' : 'budget']).toContain(choice.reason);
		}
	}
});

function checkContacts(next: Snapshot, original: Snapshot) {
	for (const [id, cell] of next) {
		if (cell.protected) expect(cell).toBe(original.get(id));
		for (const n of cell.neighbors)
			if (n !== null)
				expect(contacts[cell.form as keyof typeof contacts]).toContain(next.get(n)?.form);
	}
}
