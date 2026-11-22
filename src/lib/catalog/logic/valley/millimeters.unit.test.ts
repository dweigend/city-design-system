import { expect, test } from 'bun:test';
import { toMillimeters } from './millimeters';

test('quantizes exact half-millimeter ties toward positive infinity, including negative zero', () => {
	expect(toMillimeters(0.0015)).toBe(2);
	expect(toMillimeters(-0.0015)).toBe(-1);
	expect(toMillimeters(-0.0005)).toBe(0);
	expect(toMillimeters(0.00049)).toBe(0);
	expect(toMillimeters(-0.00051)).toBe(-1);
});

test('checks meter inputs and rounded Int32 limits before storage', () => {
	expect(toMillimeters(-2_147_483.648)).toBe(-2_147_483_648);
	expect(toMillimeters(2_147_483.647)).toBe(2_147_483_647);
	expect(() => toMillimeters(-2_147_483.649)).toThrow('height-mm-overflow');
	expect(() => toMillimeters(2_147_483.648)).toThrow('height-mm-overflow');
	expect(() => toMillimeters(Number.MAX_VALUE)).toThrow('height-mm-overflow');
	for (const invalid of [Infinity, -Infinity, NaN]) {
		expect(() => toMillimeters(invalid)).toThrow('invalid-height-m');
	}
});
