import { expect, test } from 'bun:test';
import { example } from './example';
import { createStairObject } from './index';

test('records two attachment positions and separates deck, bearing and stair roles', () => {
	const { deck, stair } = example();
	expect(deck.parts.map(({ slot }) => slot)).toEqual(['deck', 'bearing']);
	expect(deck.anchors.map(({ name }) => name)).toEqual(['start', 'end']);
	expect(stair.parts.map(({ slot }) => slot)).toEqual(['stairs']);
	expect(stair.footprint.width).toBeGreaterThan(0);
	expect(() => createStairObject({ id: 'short', points: [[0, 0, 0]] })).toThrow(RangeError);
});
