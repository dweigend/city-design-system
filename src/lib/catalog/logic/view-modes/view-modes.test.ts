import { expect, test } from 'bun:test';
import { resolveView } from './index';

const policy = {
	view: 'iso',
	views: ['iso', 'plan', 'terrain'],
	display: 'normal',
	displays: ['normal']
} as const;

test('step opens in its declared pose and display', () => {
	expect(resolveView(policy)).toMatchObject({ view: 'iso', display: 'normal' });
});

test('terrain preserves the declared display', () => {
	expect(resolveView(policy, { view: 'terrain' })).toMatchObject({
		view: 'terrain',
		display: 'normal'
	});
});

test('a disabled mode cannot be requested directly', () => {
	expect(() => resolveView(policy, { view: 'schematic' })).toThrow(RangeError);
	expect(() => resolveView({ ...policy, views: ['iso', 'terrain'] }, { view: 'plan' })).toThrow(
		RangeError
	);
});
