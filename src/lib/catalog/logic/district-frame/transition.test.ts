import { test, expect } from 'bun:test';
import { advanceSeams, compileSeams, type FrameSeam, type BayState } from './index';
import { defineRules } from '../neighbourhood';

const edges: FrameSeam[] = Array.from({ length: 4 }, (_, i) => ({
	id: String(i),
	vertices: [String(i), String(i + 1)],
	houses: ['h' + i],
	district: 'd',
	character: 'core',
	districtEdge: false,
	use: i < 2 ? 'court' : 'houses',
	intent: i < 2 ? 'main' : 'secondary',
	attachment: true
}));

test('opening outside two rings cannot feed through a protected spur', () => {
	for (let seed = 0; seed < 64; seed++) {
		const state = new Map<string, BayState>([
			['2', { built: 'secondary' }],
			['3', { pending: 'secondary', ticks: 1 }]
		]);
		const reads = new Set<string>();
		const source = state.get.bind(state);
		state.get = (id) => {
			reads.add(id);
			return source(id);
		};
		const pack = compileSeams(edges),
			opened = compileSeams([{ ...edges[0], opening: 'court-access' }, ...edges.slice(1)]);
		expect(pack.affected(['0'])).toEqual(['0', '1', '2']);
		expect(opened.tick(['3'], state, seed, 2)).toEqual(pack.tick(['3'], state, seed, 2));
		expect(reads.has('0')).toBe(false);
		state.set('1', { built: 'main' });
		expect(opened.tick(['3'], state, seed, 2).get('3')?.built).toBe('secondary');
	}
});
test('only co-admitted main bays mature, even when requesting one side of a pair', () => {
	for (let seed = 0; seed < 64; seed++) {
		const pack = compileSeams(edges.slice(0, 2));
		const state = pack.tick(['0', '1'], new Map(), seed, 1);
		const result = advanceSeams(pack, ['0'], state, seed, 2, (id) => id !== '1');
		expect(result.state.get('0')?.built).toBeUndefined();
		expect(advanceSeams(pack, ['0'], state, seed, 2, () => true).state.get('0')?.built).toBe(
			'main'
		);
	}
});
test('JSON entry arrays resume nonempty cell and seam patches', () => {
	const pack = compileSeams(edges.slice(0, 2)),
		ids = ['0', '1'];
	const rules = defineRules({ contacts: { empty: ['house', 'empty'], house: ['empty', 'house'] } });
	const cell = {
		id: 'a',
		form: 'empty',
		district: 'd',
		intent: 'house',
		neighbors: [null, null, null]
	};
	for (let seed = 0; seed < 64; seed++) {
		const patch = pack.tick(ids, new Map(), seed, 1),
			cells = rules.tick(['a'], new Map([['a', cell]]), seed);
		expect(patch.toJSON()).toEqual(JSON.parse(JSON.stringify(patch)));
		expect(JSON.parse(JSON.stringify(cells))).toHaveLength(1);
		expect(pack.tick(ids, new Map(JSON.parse(JSON.stringify(patch))), seed, 2)).toEqual(
			pack.tick(ids, patch, seed, 2)
		);
		expect(rules.tick(['a'], new Map(JSON.parse(JSON.stringify(cells))), seed)).toEqual(
			rules.tick(['a'], cells, seed)
		);
	}
});
