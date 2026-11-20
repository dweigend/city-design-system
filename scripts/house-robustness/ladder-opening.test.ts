import { expect, test } from 'bun:test';
import { paintedSections, sectionParts } from '../../src/lib/catalog/logic/composed-house';
import { ensembleAnchor } from '../../src/lib/catalog/logic/composed-house/accent';
import { squareGrid } from '../../src/lib/catalog/logic/quad-grid';

test('both ladder lanes clear the occupied floors of a six- and seven-storey pair', () => {
	const grid = squareGrid(2, 1, 5);
	const stacks = new Map(grid.cells.map((c, i) => [c.id, Array(6 + i).fill('living')]));
	const houses = paintedSections(grid, stacks, 21, { joined: () => false });
	expect(houses).toHaveLength(2);
	expect(houses.filter(ensembleAnchor)).toHaveLength(1);
	for (const house of houses) {
		const rails = sectionParts(house).filter(
			(p) => p.kind === 'pipe' && p.id.includes('/stair/ladder/')
		);
		expect(rails.length).toBeGreaterThan(0);
		for (const level of house.composition.levels.slice(1)) {
			const opening = level.bodies[0].band?.footprint?.holes.at(-1);
			if (!opening) throw Error('Missing occupied ladder opening');
			const xs = opening.map((p) => p[0]);
			for (const rail of rails) {
				if (rail.kind !== 'pipe') continue;
				for (const [x] of rail.points) {
					expect(x - rail.radius).toBeGreaterThan(Math.min(...xs));
					expect(x + rail.radius).toBeLessThan(Math.max(...xs));
				}
			}
		}
	}
});
