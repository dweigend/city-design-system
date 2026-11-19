import { expect, test } from 'bun:test';
import { planNetwork, type NetworkInput } from '../walkway-network';
import { budgetedNetwork } from './network-budget';

function street(ensembleArea: number): NetworkInput {
	return {
		ensembleArea,
		terrain: () => 0,
		blockedCells: [],
		houses: [0, 10].map((x) => ({ id: String(x), entrance: [x, 0], obstacles: [] }))
	};
}

test('a ten-metre street fits the second footprint allowance', () => {
	const input = street(75);
	expect(() => planNetwork(input, 3)).toThrow(RangeError);
	expect(budgetedNetwork(input, 3)).toEqual(planNetwork(street(150), 3));
});

test('an infeasible second allowance omits the ensemble network', () => {
	expect(budgetedNetwork(street(10), 3)).toBeUndefined();
});
