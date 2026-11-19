import { test, expect } from 'bun:test';
import { squareGrid } from '../quad-grid';
import { composeHouse, planEnsemble, planBridges, checkFit } from './index';
const sites = squareGrid(8, 1, 10).cells.map((cell, i) => ({
	cells: [cell],
	seed: 28,
	stacks: new Map([[cell.id, Array.from({ length: i + 3 }, () => 'living' as const)]])
}));
const compose = () => {
	const context = planEnsemble(sites);
	return sites.map((s) => composeHouse(s, context));
};
test('eight painted neighbours share one high point and two plinth or bar sites', () => {
	const houses = compose();
	expect(houses.filter((h) => h.role === 'high')).toHaveLength(1);
	expect(houses.filter((h) => h.role === 'bar' || h.role === 'plinth')).toHaveLength(2);
});
test('three living floors retain three inhabited decks', () => {
	const [house] = compose();
	expect(house.levels).toHaveLength(3);
	expect(house.levels.every((l) => l.bodies.some((b) => b.kind === 'capsule'))).toBe(true);
});
test('each joint transfers load to the surveyed ground', () => {
	for (const house of compose()) expect(checkFit(house.parts)).toEqual([]);
});
test('a row admits a spanning path on a shared landing datum', () => {
	const spans = planBridges(compose());
	expect(spans).toHaveLength(7);
	expect(spans.every((b) => b.from[2] === b.to[2])).toBe(true);
});
