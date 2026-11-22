import { expect, test } from 'bun:test';
import { viewModes } from '../../data/view-modes';
import { resolveView, sectionThrough } from './index';

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

test('the five-view policy resolves the two analytical views', () => {
	const available = { ...policy, views: viewModes } as const;
	expect(resolveView(available, { view: 'schematic' }).view).toBe('schematic');
	expect(resolveView(available, { view: 'section' }).view).toBe('section');
});

test('a section normal is horizontal and unit length, with its offset in meters', () => {
	const plane = sectionThrough([10, 5, 300], [3, 4]);
	expect(plane.normal).toEqual([0.6, 0.8, 0]);
	expect(plane.offsetM).toBe(10);
	expect(Object.isFrozen(plane.normal)).toBe(true);
	expect(() => sectionThrough([0, 0, 0], [0, 0])).toThrow(RangeError);
});
