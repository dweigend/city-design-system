import { expect, test } from 'bun:test';
import { pathsProjectionExample } from './example';

test('projects decks and bearings through distinct role slots in the local meter frame', () => {
	const { object, drawables } = pathsProjectionExample();
	expect(object.parts.map(({ slot }) => slot)).toEqual(['path-walkways', 'path-supports']);
	expect(object.anchors.map(({ position }) => position)).toEqual([
		[0, 0, 2],
		[10, 0, 2]
	]);
	expect(drawables.every(({ color }) => color === '--path')).toBe(true);
});
