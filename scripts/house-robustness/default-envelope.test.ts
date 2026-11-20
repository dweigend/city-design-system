import { expect, test } from 'bun:test';
import { squareGrid } from '../../src/lib/catalog/logic/quad-grid';
import { composeHouse, planEnsemble } from '../../src/lib/catalog/logic/house-typology';
import { checkExteriorEntrance } from './exterior-entrance';
import {
	paintedSections,
	planHouse,
	sectionParts
} from '../../src/lib/catalog/logic/composed-house';

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

test('the default town skin has two continuous slots across a twelve-metre elevation', () => {
	const cell = grid.cells[0];
	const house = planHouse({ cells: [cell], stacks, seed: 7 });
	const shell = house.composition.exterior;
	if (!shell) throw Error('Expected an exterior');
	const parts = sectionParts(house);
	checkExteriorEntrance(house, parts);
	const walls = parts.filter((p) => p.source.objectId === 'full-height-shell');
	expect(walls).toHaveLength(4);
	for (const p of walls) {
		if (p.kind !== 'mesh') throw Error('Expected a skin mesh');
		const crown = p.points.filter((point) => point[2] === shell.top);
		expect(crown).toHaveLength(6);
		const along = Math.abs(crown[1][0] - crown[0][0]) > Math.abs(crown[1][1] - crown[0][1]) ? 0 : 1;
		crown.sort((a, b) => a[along] - b[along]);
		for (const i of [1, 3]) {
			const gap = Math.hypot(crown[i][0] - crown[i + 1][0], crown[i][1] - crown[i + 1][1]);
			expect(gap).toBeGreaterThan(0);
			expect(gap).toBeLessThanOrEqual(0.71);
		}
	}
});
