import { expect, test } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { paintedSections } from '../composed-house';

test('four perimeter principles change occupied footprints above the same shared podium', () => {
	const grid = squareGrid(2, 1, 6);
	const stacks = new Map(grid.cells.map((c) => [c.id, Array<'living'>(8).fill('living')]));
	const profiles = new Map<string, string>();
	for (let seed = 0; seed < 64 && profiles.size < 4; seed++) {
		const [house] = paintedSections(grid, stacks, seed, { joined: () => false });
		const key = house.composition.signature.body;
		const sections = house.decks.slice(2).map((deck) => {
			const footprint = deck.bodies[0].band?.footprint;
			expect(footprint).toBeDefined();
			return [deck.width.toFixed(2), deck.depth.toFixed(2), footprint?.holes.length];
		});
		profiles.set(key, JSON.stringify(sections));
	}
	expect([...profiles.keys()].sort()).toEqual([
		'cross-stack',
		'lantern-neck',
		'lightwell',
		'terrace-fan'
	]);
	expect(new Set(profiles.values()).size).toBe(4);
});
