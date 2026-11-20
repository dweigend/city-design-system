import { expect, test } from 'bun:test';
import { required } from '../required';
import { bankPlanting, cityCorridorSite, openingScene } from './index';
import { surveyedGrid } from './town-grid';
import { surfaceHeight } from './network-terrain';
import type { TerrainGrid } from '../terrain-grid';

function relief(grid: TerrainGrid) {
	const raw = surveyedGrid(grid),
		sampled = new Map<string, number[]>();
	const cuts: number[] = [],
		shoulders: number[] = [];
	for (const cell of grid.cells) {
		if (!cell.landform) continue;
		const original = required(raw.cellsById.get(cell.id), 'survey parcel');
		cell.landform.forEach((weights, i) => {
			const key = cell.vertexIds[i],
				p = cell.corners[i];
			const survey = [p[2], ...weights];
			const adjacent = sampled.get(key);
			if (adjacent) {
				expect(survey).toEqual(adjacent);
				return;
			}
			sampled.set(key, survey);
			const dz = p[2] - original.corners[i][2];
			if (weights[2] > 0.85) cuts.push(dz);
			if (weights[1] > 0.8) shoulders.push(dz);
			expect(weights.every((w) => w >= 0 && w <= 1)).toBe(true);
		});
	}
	return { cuts, shoulders };
}

function tallestShelf(grid: TerrainGrid) {
	let height = 0;
	for (const cell of grid.cells) {
		if (cell.bank?.divisions !== 4) continue;
		for (const [x, y, z] of cell.bank.points)
			height = Math.max(height, z - surfaceHeight(cell.corners, x, y));
	}
	return height;
}

// Contour-following public routes with varying station levels in the QA survey.
for (const [seed, row, first, last] of [
	[7, 34, 69, 83],
	[13, 33, 100, 105],
	[29, 34, 87, 94]
])
	test(
		'swales and planted shoulders share the graded valley surface on seed ' + seed,
		() => {
			const { world } = openingScene(seed);
			const { cuts, shoulders } = relief(world.grid);
			expect(tallestShelf(world.grid)).toBeGreaterThan(0.55);
			expect(cuts.length).toBeGreaterThan(8);
			expect(Math.max(...cuts)).toBeLessThan(-0.35);
			expect(Math.min(...cuts)).toBeLessThan(-0.85);
			expect(shoulders.length).toBeGreaterThan(8);
			expect(shoulders.sort((a, b) => a - b)[Math.floor(shoulders.length / 2)]).toBeGreaterThan(
				0.75
			);
			const [walk, station, , ground] = required(cityCorridorSite(world), 'landscape path');
			const course = Array.from(
				{ length: last - first + 1 },
				(_, i) => station(first + i + '/' + row)[2]
			);
			expect(new Set(course).size).toBe(1);
			let dry = 0;
			for (const id of new Set(walk.flat())) {
				const c = required(world.grid.cellsById.get(id), 'landing');
				if (!c.landform || c.plan.footbridge || c.zone === 'water') continue;
				const [x, y, z] = station(id);
				const support = Math.max(ground(x, y), ...c.corners.map((p) => p[2]));
				expect(z - support).toBeCloseTo(0.1, 6);
				dry++;
			}
			expect(dry).toBeGreaterThan(0);
		},
		60000
	);

test('planted shoulders carry overlapping canopy volumes rooted on refined terrain', () => {
	const { world } = openingScene(7);
	const [walk, , , ground] = required(cityCorridorSite(world), 'walking survey');
	const reserved = new Set(walk.flat());
	const shrubs = bankPlanting(world);
	expect(shrubs.length).toBeGreaterThan(30);
	expect(new Set(shrubs.map((p) => p.slot))).toEqual(
		new Set(['foliage', 'willow', 'evergreen', 'grass', 'stem'])
	);
	expect(shrubs.filter((p) => p.kind === 'mesh').every((p) => p.smooth)).toBe(true);
	expect(bankPlanting(world)).toEqual(shrubs);
	let tallest = 0;
	for (const crown of shrubs) {
		if (crown.kind !== 'dome') {
			const parcel = crown.id.split('/').slice(1, 3).join('/');
			expect(reserved.has(parcel) || world.state.stacks.has(parcel)).toBe(false);
			expect(crown.edges).toBe(false);
			continue;
		}
		expect(crown).not.toHaveProperty('facets');
		const [x, y, z] = crown.position;
		const r = crown.radius;
		for (const [u, v] of [
			[x, y],
			[x - r, y],
			[x + r, y],
			[x, y - r],
			[x, y + r]
		]) {
			expect(z).toBeLessThan(ground(u, v));
		}
		const parcel = crown.id.split('/').slice(1, 3).join('/');
		expect(reserved.has(parcel)).toBe(false);
		expect(world.state.stacks.has(parcel)).toBe(false);
		tallest = Math.max(tallest, z + (crown.height ?? 0) - ground(x, y));
	}
	expect(tallest).toBeGreaterThan(2.5);
	const trees = shrubs.filter((p) => p.kind === 'sphere');
	expect(trees.length).toBeGreaterThan(10);
	expect(new Set(trees.map((p) => p.radius)).size).toBeGreaterThan(5);
	const parcel = shrubs[0].id.split('/').slice(1, 3).join('/');
	const occupied = {
		...world,
		state: { ...world.state, stacks: new Map(world.state.stacks).set(parcel, ['food' as const]) }
	};
	expect(bankPlanting(occupied).some((p) => p.id.split('/').slice(1, 3).join('/') === parcel)).toBe(
		false
	);
}, 60000);
