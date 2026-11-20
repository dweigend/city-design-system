import { area } from '../ansicht/geometrie';
import { houseSurfaces } from '../composed-house';
import { focuses } from '../presentation';
import { required } from '../required';
import assert from 'node:assert/strict';
import { expect, test } from 'bun:test';
import { openingScene, applyEdit, houseGroups, type World } from '../sandbox';

function remoteGeometry(world: World, lots: string[]) {
	const cells = lots.map((id) => required(world.grid.cellsById.get(id), 'remote plot'));
	const chunks = new Set(cells.map((c) => c.chunk));
	const result = [];
	for (const chunk of chunks) {
		for (const [key, parts] of houseGroups(world, chunk, focuses.all)) {
			for (const p of parts) {
				if (p.token === houseSurfaces.access.token)
					expect(p.kind === 'prism' && key.startsWith('composed/network/court/')).toBe(true);
			}
			if (lots.some((id) => key.endsWith('/' + id) || key.includes(id + '@')))
				result.push([key, parts]);
		}
	}
	return result;
}

function checkEdges(world: World, built: string[]) {
	const seen = new Set([built[0]]);
	for (const id of seen) {
		const plot = required(world.grid.cellsById.get(id), 'plot');
		for (const other of plot.neighbors)
			if (other && built.includes(other)) {
				const neighbor = required(world.grid.cellsById.get(other), 'adjacent plot');
				expect(
					plot.corners.filter((p) => neighbor.corners.some((q) => q.every((v, i) => v === p[i])))
				).toHaveLength(2);
				seen.add(other);
			}
	}
	expect(seen.size).toBe(built.length);
}

for (const seed of [7, 13, 29])
	test(
		'editable three-sided courts on valley ' + seed,
		() => {
			const { world } = openingScene(seed);
			const city = world.state.city;
			assert(city);
			const groups = city.centres.flatMap((c) => c.ensembles);
			expect(groups.length).toBeGreaterThanOrEqual(6);
			expect(groups.length).toBeLessThanOrEqual(7);
			const footprints: number[][][] = [];
			for (const group of groups) {
				const court = required(world.grid.cellsById.get(group.court), 'surveyed site');
				const built = group.lots.filter((id) => world.state.stacks.has(id));
				expect(built.length).toBeGreaterThanOrEqual(3);
				expect(group.lots.length).toBeLessThanOrEqual(6);
				checkEdges(world, built);
				expect(court.neighbors.includes(built[0])).toBe(false);
				const peak = required(world.grid.cellsById.get(built[0]), 'corner high point');
				const plotArea = (id: string) =>
					area(required(world.grid.cellsById.get(id), 'plot').corners.map(([x, y]) => [x, y]));
				expect(plotArea(peak.id)).toBe(Math.max(...group.lots.map(plotArea)));
				expect(world.state.stacks.get(peak.id)?.length).toBeGreaterThanOrEqual(3);
				const crowns = [...houseGroups(world, peak.chunk, focuses.all).values()]
					.flat()
					.filter((p) => p.id.startsWith(peak.id + '/crown/'));
				expect(new Set(crowns.map((p) => p.id.split('/').slice(0, -1).join('/'))).size).toBe(1);
				expect(world.state.stacks.has(group.court)).toBe(false);
				expect(court.neighbors.filter((id) => id && built.includes(id))).toHaveLength(3);
				const heights = built
					.map((id) => required(world.state.stacks.get(id), 'surveyed site').length)
					.sort((a, b) => b - a);
				expect(heights[0] - heights[1]).toBeGreaterThanOrEqual(2);
				expect(heights[1] - heights[heights.length - 1]).toBe(0);
				expect(heights[heights.length - 1]).toBeGreaterThanOrEqual(2);
				const bounds = group.lots.map((id) => {
					const corners = required(world.grid.cellsById.get(id), 'surveyed site').corners;
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
			const lots = groups[groups.length - 1].lots;
			const remote = remoteGeometry(world, lots);
			expect(remote.length).toBeGreaterThan(0);
			expect(JSON.stringify(remoteGeometry(edited, lots))).toBe(JSON.stringify(remote));
			expect(openingScene(seed).world.state.city).toEqual(city);
		},
		30000
	);
