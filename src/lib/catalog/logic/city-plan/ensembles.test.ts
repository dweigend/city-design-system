import { segmentSeparation } from '../walkway-network';
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

type Centre = NonNullable<World['state']['city']>['centres'][number];
function checkCluster(world: World, centre: Centre) {
	const { green, ensembles } = centre;
	const constrained = world.seed === 7 && centre.cellId === '65/37';
	expect(ensembles.length).toBeGreaterThanOrEqual(constrained ? 1 : 3);
	const closed = green.ring.length > 0;
	expect(closed).toBe(!(world.seed === 29 && centre.cellId === '65/37'));
	if (closed) expect(green.ring[0]).toBe(green.ring[green.ring.length - 1]);
	expect(ensembles.length).toBeLessThanOrEqual(4);
	const centreCell = required(world.grid.cellsById.get(centre.cellId), 'fixed centre');
	for (const axis of [0, 1]) {
		const coordinates = green.polygon.map((p) => p[axis]);
		expect(Math.max(...coordinates) - Math.min(...coordinates)).toBeCloseTo(20);
		expect((Math.max(...coordinates) + Math.min(...coordinates)) / 2).toBeCloseTo(
			centreCell.center[axis]
		);
	}
	const parcels = ensembles.map((g) =>
		[g.court, g.mouth, ...g.lots, ...required(g.plaza, 'plaza').cells].map((id) =>
			required(world.grid.cellsById.get(id), 'cluster parcel')
		)
	);
	const boxes = ensembles.map((g) => {
		const p = required(g.plaza, 'furnished plaza');
		const surfaces = [...g.lots, g.court].map(
			(id) =>
				required(world.grid.cellsById.get(id), 'parcel').corners as readonly (readonly number[])[]
		);
		surfaces.push(p.polygon, p.apron, p.bed, p.steps);
		return surfaces.flatMap((corners) => {
			const poly = corners.map(([x, y]): [number, number] => [x, y]);
			return poly.map((a, i) => ({ a, b: poly[(i + 1) % poly.length] }));
		});
	});
	for (const [i, a] of boxes.entries())
		for (const b of boxes.slice(i + 1)) {
			const gap = Math.min(...a.flatMap((p) => b.map((q) => segmentSeparation(p, q))));
			expect(gap).toBeGreaterThanOrEqual(12);
			expect(gap).toBeLessThanOrEqual(20);
		}
	const points = [...green.polygon, ...parcels.flat().flatMap((c) => c.corners)];
	for (const axis of [0, 1])
		expect(
			Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis]))
		).toBeLessThanOrEqual(120);
	checkPlanting(world, centre);
}
function checkPlanting(world: World, centre: Centre) {
	const { green, ensembles } = centre;
	const centreCell = required(world.grid.cellsById.get(centre.cellId), 'green origin');
	expect(green.cells.some((id) => world.state.cover.has(id))).toBe(true);
	if (ensembles.length === 1) return;
	const homes = ensembles.map((g) => required(world.grid.cellsById.get(g.court), 'court').center);
	const neighbours = [centreCell.center, ...homes];
	const middles = neighbours.flatMap((p, i) =>
		neighbours.slice(i + 1).map((q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2])
	);
	expect(
		[...world.state.cover.keys()].some((id) => {
			const [x, y] = required(world.grid.cellsById.get(id), 'green cover').center;
			return middles.some(([a, b]) => Math.hypot(x - a, y - b) < 10);
		})
	).toBe(true);
	expect(green.planting.every((id) => world.state.cover.has(id))).toBe(true);
}
for (const seed of [7, 13, 29])
	test(
		'editable three-sided courts on valley ' + seed,
		() => {
			const { world } = openingScene(seed);
			const city = world.state.city;
			assert(city);
			const groups = city.centres.flatMap((c) => c.ensembles);
			for (const centre of city.centres) checkCluster(world, centre);

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
				expect(court.neighbors.filter((id) => id && built.includes(id))).toHaveLength(
					group.openingPlots === 3 ? 2 : 3
				);
				const heights = built
					.map((id) => required(world.state.stacks.get(id), 'surveyed site').length)
					.sort((a, b) => b - a);
				expect(heights[0] - heights[1]).toBeGreaterThanOrEqual(2);
				expect(heights[1] - heights[heights.length - 1]).toBe(0);
				expect(heights[heights.length - 1]).toBeGreaterThanOrEqual(2);
				const plaza = required(group.plaza, 'reserved plaza');
				expect(plaza.cells.every((id) => !world.state.stacks.has(id))).toBe(true);
			}
			const edited = applyEdit(world, { kind: 'raise', cellId: groups[0].lots[0], use: 'food' });
			for (const group of groups.slice(1))
				for (const id of group.lots) {
					expect(edited.state.storyParts.get(id)).toBe(world.state.storyParts.get(id));
				}
			const lots = groups.slice(1).flatMap((g) => g.lots);
			const remote = remoteGeometry(world, lots);
			expect(remote.length).toBeGreaterThan(0);
			expect(JSON.stringify(remoteGeometry(edited, lots))).toBe(JSON.stringify(remote));
			expect(openingScene(seed).world.state.city).toEqual(city);
		},
		30000
	);
