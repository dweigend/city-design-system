// @ts-expect-error Bun supplies its test API at runtime.
import { expect, test } from 'bun:test';
import { hashUnit } from '../../core/random';
import { defineRules } from '../../core/neighbourhood';
import { compileSeams, omissionMeasures, type BayState, type FrameSeam } from './index';

function strip(seed: number): FrameSeam[] {
	// Each polygon contributes a seeded 3–5 sided ring, adjacent rings share one side.
	let entry: [string, string] = ['bottom', 'top'];
	const edges = new Map<string, FrameSeam>();
	for (let i = 0; i < 8; i++) {
		const exit: [string, string] = ['b' + i, 't' + i];
		const count = 3 + Math.floor(hashUnit(seed, i, 'corners') * 3);
		if (count === 3) exit[1] = entry[1];
		const ring = [
			...new Set([entry[0], exit[0], ...(count === 5 ? ['bend' + i] : []), exit[1], entry[1]])
		];
		for (const [side, a] of ring.entries()) {
			const b = ring[(side + 1) % ring.length];
			const vertices: [string, string] = a < b ? [a, b] : [b, a];
			const id = JSON.stringify(vertices),
				old = edges.get(id);
			edges.set(id, {
				id,
				vertices,
				houses: [...(old?.houses ?? []), 'h' + i],
				district: 'd',
				character: 'core',
				districtEdge: false,
				use: old ? 'houses' : 'court',
				attachment: true
			});
		}
		entry = exit;
	}
	return [...edges.values()];
}

test('64 small polygon graphs preserve ordering, two-ring repair and monotonic built stock', () => {
	for (let seed = 0; seed < 64; seed++) {
		const seams = strip(seed),
			ids = seams.map((s) => s.id),
			rules = compileSeams(seams);
		const reversed = compileSeams([...seams].reverse());
		const state = new Map<string, BayState>(),
			first = rules.solve(ids, state, seed);
		expect([...reversed.solve([...ids].reverse(), state, seed)]).toEqual([...first]);
		const index = Math.floor(hashUnit(seed, 'edit', 'index') * seams.length),
			edit = seams[index].id;
		const changed = compileSeams(
			seams.map((s) => (s.id === edit ? { ...s, opening: 'passage' } : s))
		);
		const halo = changed.affected([edit]);
		expect(new Map([...first, ...changed.solve(halo, state, seed)])).toEqual(
			changed.solve(ids, state, seed)
		);
		for (let tick = 1; tick <= 5; tick++) {
			const pack = tick < 4 ? rules : changed;
			const prior = new Map(state);
			const full = pack.tick(ids, state, seed, tick);
            expect(pack.tick(halo, state, seed, tick)).toEqual(new Map([...full].filter(([id]) => halo.includes(id))));
            for (const [id, bay] of full) state.set(id, bay);
			for (const [id, bay] of prior) {
				if (bay.built) expect(state.get(id)?.built).toBeTruthy();
				if (bay.built === 'main') expect(state.get(id)?.built).toBe('main');
			}
		}
	}
});

test('matched main spans mature after two ticks and a later opening cannot demolish built stock', () => {
	const s: FrameSeam = {
		id: 'a',
		vertices: ['0', '1'],
		houses: ['h0'],
		district: 'd',
		character: 'core',
		districtEdge: false,
		use: 'court',
		intent: 'main'
	};
	const other: FrameSeam = { ...s, id: 'b', vertices: ['1', '2'], houses: ['h1'] };
	const rule = compileSeams([s, other]),
		ids = ['a', 'b'];
	const pending = rule.tick(ids, new Map(), 7, 1);
	expect(pending.get('a')).toEqual({ pending: 'main', ticks: 1 });
	const built = rule.tick(ids, pending, 7, 2);
	expect(built.get('b')).toEqual({ built: 'main', builtTick: 2 });
	expect(compileSeams([{ ...s, opening: 'passage' }, other]).tick(ids, built, 7, 3).size).toBe(0);
});

for (const measure of omissionMeasures)
	test(measure + ' is evidence and has no placement vote', () => {
		const seams = strip(7),
			rule = compileSeams(seams),
			id = seams[0].id;
		const clean = rule.explain(id, new Map(), 7, { [measure]: 0 });
		const flagged = rule.explain(id, new Map(), 7, { [measure]: 1 });
		expect(flagged.role).toBe(clean.role);
		expect(flagged.reason).toBe(clean.reason);
		expect(flagged.diagnostics).toContainEqual({ measure, value: 1 });
	});

test('snapshot preferences preserve city vetoes, protected stock and neutral replay', () => {
	const policy = {
		contacts: { hall: ['hall', 'market'], market: ['hall', 'market'] },
		city: { market: 0 }
	};
	const a = {
		id: 'a',
		district: 'd',
		form: 'hall',
		neighbors: [null, null, null],
		protected: true
	};
	const stock = new Map([[a.id, a]]);
	const base = defineRules(policy),
		neutral = defineRules({ ...policy, preferences: { d: { formMultipliers: { hall: 1 } } } });
	expect(neutral.solve(['a'], stock, 7)).toEqual(base.solve(['a'], stock, 7));
	const biased = defineRules({
		...policy,
		preferences: { d: { formMultipliers: { market: 100 } } }
	});
	expect(biased.tick(['a'], stock, 7).size).toBe(0);
	expect(stock.get('a')).toBe(a);
	expect(biased.explain('a', new Map([['a', { ...a, protected: false }]]), 7).target).toBe('hall');
});
