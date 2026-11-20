import { expect, test } from 'bun:test';
import { acceptanceScene, TWO_SUNS_MAST } from '../../logic/sandbox';
import { columnSeats } from './column-seats';

test('the mast seats on its plinth, and the plinth seats on terrain', () => {
	const { additions, world } = acceptanceScene(7);
	const mast = additions.find((p) => p.id === TWO_SUNS_MAST);
	if (mast?.kind !== 'cylinder') throw Error('Missing acceptance mast');
	const seats = columnSeats(additions, world.grid);
	expect(seats.some((s) => s.diameter === 6)).toBe(true);
	expect(seats.some((s) => s.diameter === mast.radius * 2 && s.point[2] === mast.position[2])).toBe(
		true
	);
	expect(
		columnSeats(
			[{ ...mast, position: [mast.position[0], mast.position[1], mast.position[2] + 5] }],
			world.grid
		)
	).toHaveLength(0);
});
