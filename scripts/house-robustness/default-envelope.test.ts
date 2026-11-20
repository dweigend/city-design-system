import { expect, test } from 'bun:test';
import { squareGrid } from '../../src/lib/catalog/logic/quad-grid';
import { composeHouse, planEnsemble } from '../../src/lib/catalog/logic/house-typology';
import { paintedSections, planHouse } from '../../src/lib/catalog/logic/composed-house';

const grid = squareGrid(3, 1, 12);
const row = ['water', 'living', 'food'] as const;
const stacks = new Map(grid.cells.map((c) => [c.id, row]));
for (const [i, cell] of grid.cells.entries()) {
	test('plain parcel uses the same envelope at both house planner entry points ' + i, () => {
		const site = { cells: [cell], seed: 7 + i, stacks };
		const context = planEnsemble([site]);
		const baseline = composeHouse({ ...site, envelope: {} }, context);
		const house = planHouse({ ...site, context });
		expect(house.composition.exterior).toBeDefined();
		expect(house.composition).toEqual(baseline);
	});
}
test('painting an unplanned group uses parcel envelopes on equal-width lots', () => {
	const houses = paintedSections(grid, stacks, 7, { joined: () => false });
	expect(houses).toHaveLength(3);
	for (const h of houses) expect(h.composition.exterior?.top).toEqual(h.top);
});
