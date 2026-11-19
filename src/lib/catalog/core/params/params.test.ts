import { expect, test } from 'bun:test';
import { defineParams, numberParam, resolveParams } from './index';

const fields = {
	radius: numberParam('Radius', 'm', 0.55, [0.1, 3, 0.05]),
	cars: numberParam('Cars', 'cars', 3, [1, 8, 1], 'integer')
};
const schema = defineParams(fields);

test('reads detached defaults from a frozen, serializable schema', () => {
	expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
	expect(Object.isFrozen(schema)).toBe(true);
	expect(Object.isFrozen(schema.radius)).toBe(true);
	expect(schema.radius).not.toBe(fields.radius);
	expect(schema.radius).toEqual({
		type: 'number',
		label: 'Radius',
		unit: 'm',
		default: 0.55,
		min: 0.1,
		max: 3,
		step: 0.05
	});
	expect(resolveParams(schema)).toEqual({ radius: 0.55, cars: 3 });
	expect(resolveParams(schema)).not.toBe(resolveParams(schema));
});

test('inherits by field and gives caller values precedence', () => {
	expect(resolveParams(schema, { radius: 1, cars: 2 }, { radius: 1.123, cars: undefined })).toEqual(
		{
			radius: 1.123,
			cars: 2
		}
	);
	expect(resolveParams(schema, { radius: undefined }, { cars: 8 })).toEqual({
		radius: 0.55,
		cars: 8
	});
	expect(resolveParams(schema, { radius: 0.1 }, { cars: 1 })).toEqual({ radius: 0.1, cars: 1 });
});

test('validates both layers independently', () => {
	expect(() => resolveParams(schema, { radius: -1 }, { radius: 3 })).toThrow(RangeError);
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
