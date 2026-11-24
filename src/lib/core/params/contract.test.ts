import { expect, test } from 'bun:test';
import { blockInputs, defineParams, resolveParams } from './index';

test('returns defaults and detaches a schema from its caller', () => {
	const field = { label: 'Radius', unit: 'm', default: 2, min: 1, max: 3, step: 0.25 };
	const schema = defineParams({ radius: field });
	field.default = 3;
	expect(Object.isFrozen(schema)).toBe(true);
	expect(Object.isFrozen(schema.radius)).toBe(true);
	expect(schema.radius).not.toBe(field);
	expect(resolveParams(schema)).toEqual({ radius: 2 });
	expect(resolveParams(schema)).not.toBe(resolveParams(schema));
	expect(resolveParams(blockInputs)).toEqual({ height: 4, width: 9, complexity: 0.5 });
});

test('accepts both inclusive bounds of all three shared inputs', () => {
	const min = { height: 1, width: 1, complexity: 0 };
	const max = { height: 32, width: 32, complexity: 1 };
	expect(resolveParams(blockInputs, min)).toEqual(min);
	expect(resolveParams(blockInputs, max)).toEqual(max);
	expect(resolveParams(blockInputs, { height: -4, width: -1, complexity: -0.1 })).toEqual(min);
	expect(resolveParams(blockInputs, { height: 40, width: 33, complexity: 2 })).toEqual(max);
});

test('snaps to steps from the lower bound and rejects invalid override values', () => {
	expect(resolveParams(blockInputs, { height: 2.49, width: 8.26, complexity: 0.523 })).toEqual({
		height: 2.5,
		width: 8.3,
		complexity: 0.52
	});
	const field = { label: 'Radius', unit: 'm', default: 1.25, min: 1.25, max: 3, step: 0.5 };
	expect(resolveParams(defineParams({ radius: field }), { radius: 1.5 })).toEqual({ radius: 1.75 });
	expect(() => resolveParams(blockInputs, { height: undefined })).toThrow(TypeError);
	for (const height of [NaN, Infinity, -Infinity]) {
		expect(() => resolveParams(blockInputs, { height })).toThrow(RangeError);
	}
	const overrides = { width: 2, other: 3 };
	expect(() => resolveParams(blockInputs, overrides)).toThrow(TypeError);
});

test('rejects invalid field metadata and defaults', () => {
	const { height } = blockInputs;
	for (const invalid of [
		{ ...height, step: 0 },
		{ ...height, max: Infinity },
		{ ...height, default: 0 }
	]) {
		expect(() => defineParams({ height: invalid })).toThrow(RangeError);
	}
});

test.each([
	{ name: 'default', fallback: 0.5, input: {}, expected: 0.5 },
	{ name: 'off-step default', fallback: 0.3, input: {}, expected: 0.3 },
	{ name: 'min', fallback: 0.3, input: { width: 0 }, expected: 0 },
	{ name: 'max', fallback: 0.3, input: { width: 1 }, expected: 1 },
	{ name: 'negative zero', fallback: 0.3, input: { width: -0 }, expected: 0 }
])('resolving $name again preserves the value', ({ fallback, input, expected }) => {
	const schema = defineParams({
		width: { label: 'Width', unit: 'm', default: fallback, min: 0, max: 1, step: 0.5 }
	});
	const resolved = resolveParams(schema, input);
	expect(resolved.width).toBe(expected);
	expect(resolveParams(schema, resolved)).toEqual(resolved);
});
