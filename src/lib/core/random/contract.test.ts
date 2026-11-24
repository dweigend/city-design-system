import { expect, test } from 'bun:test';
import { Random } from './index';

const golden = [
	0.011704753153026104, 0.06195825757458806, 0.97690763277933, 0.6990287057124078,
	0.5214452685322613
];

function draws(random: Random): number[] {
	return Array.from({ length: golden.length }, () => random.number());
}

test('matches the golden Mulberry32 sequence on every seed-7 run', () => {
	expect(Object.isFrozen(Random)).toBe(true);
	expect(draws(Random.create({ seed: 7 }))).toEqual(golden);
	expect(draws(Random.create({ seed: 7, algorithm: 'mulberry32' }))).toEqual(golden);
	expect(draws(Random.create())).toEqual(draws(Random.create({ seed: 1 })));
	expect(draws(Random.create({ seed: -1 }))).toEqual(draws(Random.create({ seed: 0xffffffff })));
});

test('restores a serialized state and copies the same tail independently', () => {
	const random = Random.create({ seed: 7 });
	random.number();
	const state = random.state;
	expect(Object.isFrozen(state)).toBe(true);
	expect(Object.isFrozen(state.continuation)).toBe(true);
	const restored = Random.create();
	restored.state = JSON.parse(JSON.stringify(state));
	const copied = random.copy();
	const tail = draws(random);
	expect(draws(copied)).toEqual(tail);
	expect(draws(restored)).toEqual(tail);
	expect(restored.seed).toBe(7);
	expect(state.continuation.word).not.toBe(random.state.continuation.word);
});

test('interleaving does not affect either independent stream', () => {
	const a = Random.create({ seed: 7 });
	const b = Random.create({ seed: 9 });
	const pairs = Array.from({ length: golden.length }, () => [a.number(), b.number()]);
	expect(pairs.map(([first]) => first)).toEqual(golden);
	expect(pairs.map(([, second]) => second)).toEqual(draws(Random.create({ seed: 9 })));
});

test('derives distinct keyed children independent of parent and sibling draw order', () => {
	const first = Random.create({ seed: 7 });
	const structure = first.derive('structure');
	first.number();
	const decor = first.derive('decor');
	const a = draws(structure);
	const b = draws(decor);
	const second = Random.create({ seed: 7 });
	second.number();
	expect(draws(second.derive('decor'))).toEqual(b);
	second.number();
	expect(draws(second.derive('structure'))).toEqual(a);
	expect(draws(first.derive('structure'))).toEqual(a);
	expect(a).not.toEqual(b);
	expect(draws(Random.create({ seed: 9 }).derive('structure'))).not.toEqual(a);
	expect(first.number()).toBe(golden[1]);
	expect(second.number()).toBe(golden[2]);
});

test('validates options and restores atomically before consuming any draws', () => {
	const random = Random.create({ seed: 7 });
	const state = random.state;
	const unknownOptions = { min: 0, typo: true };
	expect(() => random.number(unknownOptions)).toThrow(TypeError);
	expect(() => random.number({ min: NaN })).toThrow(RangeError);
	expect(() => random.number({ min: 1, max: 1 })).toThrow(RangeError);
	expect(() => random.number({ min: 0.5, integer: true })).toThrow(RangeError);
	expect(() => Random.create({ seed: Infinity })).toThrow(RangeError);
	expect(() => Random.create({ seed: '7' as unknown as number })).toThrow(TypeError);
	expect(() => random.sample(null as unknown as readonly string[])).toThrow(TypeError);
	expect(() => random.derive(undefined as unknown as string)).toThrow(TypeError);
	expect(() => {
		random.state = { ...state, seed: 9, continuation: { ...state.continuation, word: -1 } };
	}).toThrow(RangeError);
	expect(random.state).toEqual(state);
	expect(draws(random)).toEqual(golden);
});

test('draws uniform numbers and samples one reference with one draw each', () => {
	const random = Random.create({ seed: 7 });
	const item = { id: 'court' };
	expect(random.sample([])).toEqual([]);
	expect(random.number({ min: 1, max: 3 })).toBe(1 + golden[0] * 2);
	expect(random.number({ min: 2, max: 7, integer: true })).toBe(2);
	expect(random.sample(Object.freeze([{ id: 'hall' }, item]))[0]).toBe(item);
	expect(random.number()).toBe(golden[3]);
});

test('keeps rounded uniform results below the excluded upper endpoint', () => {
	const random = Random.create({ seed: 7 });
	random.number();
	random.number();
	expect(random.number({ min: -Number.MIN_VALUE, max: 0 })).toBe(-Number.MIN_VALUE);
	expect(Number.isFinite(random.number({ min: -Number.MAX_VALUE, max: Number.MAX_VALUE }))).toBe(
		true
	);
});

test('sampling rejects holes before drawing, including inherited indices', () => {
	const random = Random.create({ seed: 7 });
	const state = random.state;
	const sparse = ['first', 'middle', 'third'];
	delete sparse[1];
	for (const list of [sparse, Object.setPrototypeOf(sparse.slice(), { 1: 'inherited' })]) {
		expect(() => random.sample(list)).toThrow(TypeError);
		expect(random.state).toEqual(state);
	}
	expect(random.sample([])).toEqual([]);
	expect(random.state).toEqual(state);
});
