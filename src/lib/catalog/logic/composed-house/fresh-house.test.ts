import { expect, test } from 'bun:test';
import { checkFit } from '../house-typology';
import { accessShare } from './access-budget';
import { bounds } from '../ansicht/geometrie';
import { squareGrid } from '../quad-grid';
import type { HouseUse } from '../../data/house-body';
import { houseLinks, circulation, planHouse, sectionParts } from './index';

const HEIGHTS = [3, 8, 16];
const SPANS = [4.5, 10];
const SEEDS = [1, 7, 23, 41];

function painted(span: number, storeys: number, seed: number, id = '1/1') {
	const grid = squareGrid(4, 3, span);
	const cell = grid.cellsById.get(id);
	if (!cell) throw new RangeError('Missing test cell');
	const stack = Array<HouseUse>(storeys).fill('living');
	return { grid, section: planHouse({ cells: [cell], stacks: new Map([[id, stack]]), seed }) };
}
function volume(part: Parameters<typeof bounds>[0]) {
	const b = bounds(part);
	return b.max.reduce((v, end, i) => v * (end - b.min[i]), 1);
}

test('a freshly painted house of 3, 8 and 16 storeys is one figure with one stair path', () => {
	for (const span of SPANS)
		for (const storeys of HEIGHTS)
			for (const seed of SEEDS) {
				const { section } = painted(span, storeys, seed);
				const parts = sectionParts(section);
				const bodies = parts.filter((p) => /\/(body|bodies|capsule|crown)/.test(p.id));
				const total = parts.reduce((sum, p) => sum + volume(p), 0);
				expect(checkFit(section.composition.parts)).toEqual([]);
				expect(accessShare(parts)).toBeLessThanOrEqual(0.1);
				expect(circulation(section).stops.length).toBe(section.decks.length + 2);
				// Only a layered house owes its mass to stacked bodies.
				if (section.composition.structure.principle === 'layers')
					expect(bodies.reduce((sum, p) => sum + volume(p), 0) / total).toBeGreaterThan(
						accessShare(parts) * 3
					);
				expect(parts.every((p) => bounds(p).max.every(Number.isFinite))).toBe(true);
			}
});

test('neighbouring fresh houses of unequal height never radiate stair bridges', () => {
	for (const span of SPANS)
		for (const seed of SEEDS) {
			const grid = squareGrid(4, 3, span);
			const houses = HEIGHTS.map((storeys, i) => {
				const id = i + '/1';
				const cell = grid.cellsById.get(id);
				if (!cell) throw new RangeError('Missing test cell');
				const stack = Array<HouseUse>(storeys).fill('living');
				return planHouse({ cells: [cell], stacks: new Map([[id, stack]]), seed });
			});
			const links = houseLinks(grid, houses, seed);
			expect(links.length).toBeLessThanOrEqual(houses.length - 1);
			for (const link of links) {
				expect(link.kind).not.toBe('stair-bridge');
				expect(Math.abs(link.from[2] - link.to[2])).toBeLessThanOrEqual(0.3);
			}
		}
});
