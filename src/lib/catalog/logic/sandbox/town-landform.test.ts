import { expect, test } from 'bun:test';
import { required } from '../required';
import { cityCorridorSite, openingScene } from './index';
import { surveyedGrid } from './town-grid';
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

for (const seed of [7, 13, 29])
	test(
		'swales and planted shoulders share the graded valley surface on seed ' + seed,
		() => {
			const { world } = openingScene(seed);
			const { cuts, shoulders } = relief(world.grid);
			expect(cuts.length).toBeGreaterThan(8);
			expect(Math.max(...cuts)).toBeLessThan(-0.35);
			expect(shoulders.length).toBeGreaterThan(8);
			expect(shoulders.sort((a, b) => a - b)[Math.floor(shoulders.length / 2)]).toBeGreaterThan(
				0.08
			);
			const [walk, station, , ground] = required(cityCorridorSite(world), 'landscape path');
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
