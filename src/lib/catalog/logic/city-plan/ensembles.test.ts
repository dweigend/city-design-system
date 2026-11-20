import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { openingScene, applyEdit } from '../sandbox';

for (const seed of [7, 13, 29])
	test(
		'editable three-sided courts on valley ' + seed,
		() => {
			const { world } = openingScene(seed);
			const city = world.state.city;
			assert(city);
			const groups = city.centres.flatMap((c) => c.ensembles);
			expect(groups.length).toBeGreaterThanOrEqual(5);
			expect(groups.length).toBeLessThanOrEqual(8);
			const footprints: number[][][] = [];
			for (const group of groups) {
				const court = world.grid.cellsById.get(group.court)!;
				const built = group.lots.filter((id) => world.state.stacks.has(id));
				expect(built.length).toBeGreaterThanOrEqual(3);
				expect(group.lots.length).toBeLessThanOrEqual(8);
				expect(world.state.stacks.has(group.court)).toBe(false);
				expect(court.neighbors.filter((id) => id && built.includes(id))).toHaveLength(3);
				const heights = built.map((id) => world.state.stacks.get(id)!.length).sort((a, b) => b - a);
				expect(heights[0] - heights[1]).toBeGreaterThanOrEqual(2);
				expect(heights[1] - heights.at(-1)!).toBeLessThanOrEqual(1);
				expect(heights.at(-1)!).toBeGreaterThanOrEqual(2);
				const bounds = group.lots.map((id) => {
					const corners = world.grid.cellsById.get(id)!.corners;
					const xs = corners.map((p) => p[0]),
						ys = corners.map((p) => p[1]);
					return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
				});
				for (const a of bounds)
					for (const b of footprints.flat()) {
						expect(
							Math.hypot(
								Math.max(0, a[0] - b[1], b[0] - a[1]),
								Math.max(0, a[2] - b[3], b[2] - a[3])
							)
						).toBeGreaterThanOrEqual(12);
					}
				footprints.push(bounds);
			}
			const edited = applyEdit(world, { kind: 'raise', cellId: groups[0].lots[0], use: 'food' });
			for (const group of groups.slice(1))
				for (const id of group.lots) {
					expect(edited.state.storyParts.get(id)).toBe(world.state.storyParts.get(id));
				}
			expect(openingScene(seed).world.state.city).toEqual(city);
		},
		30000
	);
