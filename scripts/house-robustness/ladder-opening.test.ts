import { expect, test } from 'bun:test';
import { checkExteriorEntrance } from './exterior-entrance';
import { footprint, plotCovers } from '../../src/lib/catalog/logic/composed-house/parcel-footprint';
import {
	circulation,
	planHouse,
	paintedSections,
	sectionParts
} from '../../src/lib/catalog/logic/composed-house';
import { ensembleAnchor } from '../../src/lib/catalog/logic/composed-house/accent';
import { squareGrid } from '../../src/lib/catalog/logic/quad-grid';

type House = ReturnType<typeof paintedSections>[number];
type Rail = { points: [number, number, number][]; radius: number };

/** Ladder stiles of one house as plain pipes. */
function ladderRails(house: House): Rail[] {
	const rails: Rail[] = [];
	for (const part of sectionParts(house)) {
		if (part.kind === 'pipe' && part.id.includes('/stair/ladder/')) rails.push(part);
	}
	return rails;
}

/** X extent of the ladder opening on every occupied level above the ground. */
function openingSpans(house: House): [number, number][] {
	return house.composition.levels.slice(1).map((level) => {
		const opening = level.bodies[0].band?.footprint?.holes.at(-1);
		if (!opening) throw Error('Missing occupied ladder opening');
		const xs = opening.map((p) => p[0]);
		return [Math.min(...xs), Math.max(...xs)];
	});
}

/** Asserts that every stile point, widened by its radius, stays inside the span. */
function expectInside(rails: Rail[], [min, max]: [number, number]) {
	for (const rail of rails) {
		for (const [x] of rail.points) {
			expect(x - rail.radius).toBeGreaterThan(min);
			expect(x + rail.radius).toBeLessThan(max);
		}
	}
}

test('both ladder lanes clear the occupied floors of a six- and seven-storey pair', () => {
	const grid = squareGrid(2, 1, 5);
	const stacks = new Map(grid.cells.map((c, i) => [c.id, Array(6 + i).fill('living')]));
	const houses = paintedSections(grid, stacks, 21, { joined: () => false });
	expect(houses).toHaveLength(2);
	expect(houses.filter(ensembleAnchor)).toHaveLength(1);
	for (const house of houses) {
		const rails = ladderRails(house);
		expect(rails.length).toBeGreaterThan(0);
		for (const span of openingSpans(house)) expectInside(rails, span);
	}
});

test('a narrow one-storey house keeps a clear approach to one continuous side ladder', () => {
	const cells = squareGrid(1, 1, 1.8).cells;
	for (const seed of [2, 19]) {
		const house = planHouse({ cells, seed, stacks: new Map([[cells[0].id, ['living']]]) });
		const parts = sectionParts(house);
		checkExteriorEntrance(house, parts);
		const walk = circulation(house);
		const rails = parts.filter((p) => p.id.includes('/stair/ladder/'));
		expect(rails).toHaveLength(2);
		for (const rail of rails) {
			if (rail.kind !== 'pipe') throw Error('Missing ladder stile');
			const stop = walk.stops.at(-1);
			const head = rail.points.at(-1);
			if (!stop || !head) throw Error('Missing ladder end');
			expect(rail.points[0][2]).toBeCloseTo(stop[2]);
			expect(head[2]).toBeCloseTo(house.top);
		}
		for (const part of parts.filter((p) => p.id.includes('/stair/')))
			expect(plotCovers(cells, footprint(part), 0), part.id).toBe(true);
		for (const { door } of walk.docks) {
			const plate = parts.find(
				(p) =>
					p.kind === 'prism' &&
					p.id.includes('/stair/landing/') &&
					Math.abs(p.z + p.height - door[2]) < 1e-8
			);
			if (plate?.kind !== 'prism') throw Error('Missing exit landing');
			expect(plate.polygon.some(([x]) => Math.abs(x - door[0]) < 1e-8)).toBe(true);
		}
	}
});
