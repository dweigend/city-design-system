import { expect, test } from 'bun:test';
import { example } from './example';

test('a sampled rise opens the entrance and keeps program only on the occupied datum', () => {
	const house = example();
	const id = 'lane-plot/strip/[0,0]';
	expect(house.entrances).toEqual([[id]]);
	expect(house.site).toEqual({ entranceRiseM: 1.5, laneZ: 8.5, corner: false, groundZ: null });
	expect(house.cells).toEqual([
		{
			id,
			role: 'gate',
			fromStorey: 1,
			toStorey: 2,
			program: [
				{
					phase: 'addition',
					use: 'office',
					key: '["lane-plot","lane-plot/strip/[0,0]","d",6]',
					cellId: id,
					storey: 1,
					datumIndex: 6
				}
			]
		}
	]);
});
