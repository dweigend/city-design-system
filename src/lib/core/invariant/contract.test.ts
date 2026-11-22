import { expect, test } from 'bun:test';
import { required } from './index';

test('returns the original value and permits falsy values', () => {
	const value = { id: 'block' };
	expect(required(value, 'block')).toBe(value);
	expect(required(0, 'count')).toBe(0);
	expect(required(false, 'visible')).toBe(false);
	expect(required('', 'label')).toBe('');
});

test('names the broken invariant for null and undefined', () => {
	for (const value of [null, undefined]) {
		expect(() => required(value, 'block id')).toThrow(new Error('Broken invariant: block id'));
	}
});
