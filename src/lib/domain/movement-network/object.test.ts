import { expect, test } from 'bun:test';
import { example } from './example';
import type { Vec3 } from '../../core/geometry';
import { createStairObject, createWalkwayObject, validateStairEdge } from './index';

test('records two attachment positions and separates deck, bearing and stair roles', () => {
	const { deck, stair } = example();
	expect(deck.parts.map(({ slot }) => slot)).toEqual(['deck', 'bearing']);
	expect(deck.anchors.map(({ name }) => name)).toEqual(['start', 'end']);
	expect(stair.parts.map(({ slot }) => slot)).toEqual(['stairs']);
	expect(stair.footprint.width).toBeGreaterThan(0);
	expect(() => createStairObject({ id: 'short', points: [[0, 0, 0]] })).toThrow(RangeError);
});

test('rejects flat and vertical hosts and preserves the landings after a real approach', () => {
	expect(() =>
		createStairObject({
			id: 'flat',
			points: [
				[0, 0, 0],
				[3, 0, 0]
			]
		})
	).toThrow(/inclined run/);
	expect(() =>
		createStairObject({
			id: 'vertical',
			points: [
				[0, 0, 0],
				[0, 0, 3]
			]
		})
	).toThrow(/horizontal length/);
	const id = 'flight';
	const run = [
		[0, 0, 0],
		[3, 0, 2],
		[3, 3, 2]
	] as const;
	const flight = createStairObject({ id, points: run });
	const approach = createStairObject({ id, points: [[-3, 0, 0], [-1, 0, 0], ...run] });
	expect(approach.parts).toEqual(flight.parts);
	expect(approach.anchors[0].position).toEqual([-3, 0, 0]);
	expect(createStairObject({ id, points: run.slice(0, 2) }).parts).not.toEqual(flight.parts);
});

test.each([validateStairEdge, createStairObject, createWalkwayObject])(
	'rejects a malformed intermediate point in %p',
	(read) => {
		// An external edge can violate its declared tuple type.
		const intermediate = [3, 0, 2, 1] as unknown as Vec3;
		expect(() => read({ id: 'flight', points: [[0, 0, 0], intermediate, [6, 0, 4]] })).toThrow(
			'finite XYZ'
		);
	}
);
