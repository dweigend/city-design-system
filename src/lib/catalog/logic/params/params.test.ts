// @ts-expect-error Bun provides this test API at runtime; the app only includes Node types.
import { expect, test } from 'bun:test';
import { defineParams, resolveParams } from './index';

const schema = defineParams({
	radius: {
		type: 'number',
		label: 'Radius',
		unit: 'm',
		default: 0.55,
		min: 0.1,
		max: 3,
		step: 0.05
	},
	cars: { type: 'integer', label: 'Cars', unit: 'cars', default: 3, min: 1, max: 8, step: 1 }
});

test('reads detached defaults from a serializable schema', () => {
	expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
	expect(resolveParams(schema)).toEqual({ radius: 0.55, cars: 3 });
	expect(resolveParams(schema)).not.toBe(resolveParams(schema));
});

test('inherits by field and gives caller values precedence', () => {
	expect(resolveParams(schema, { radius: 1, cars: 2 }, { radius: 1.123 })).toEqual({
		radius: 1.123,
		cars: 2
	});
});

test('validates the effective values after merging', () => {
	expect(resolveParams(schema, { radius: -1 }, { radius: 3 }).radius).toBe(3);
	for (const radius of [NaN, Infinity, 0, 3.1]) {
		expect(() => resolveParams(schema, {}, { radius })).toThrow(RangeError);
	}
	expect(() => resolveParams(schema, {}, { cars: 2.5 })).toThrow(RangeError);
});

test('rejects unknown override keys', () => {
	const overrides = { cars: 2, typo: 4 };
	expect(() => resolveParams(schema, overrides)).toThrow(RangeError);
});

test('rejects invalid schema metadata and defaults', () => {
	const radius = schema.radius;
	for (const field of [
		{ ...radius, step: 0 },
		{ ...radius, max: Infinity },
		{ ...radius, default: -1 }
	]) {
		expect(() => defineParams({ radius: field })).toThrow(RangeError);
	}
});
