import { pathSupports } from '../linear-path';
import { cityCorridorPlan } from './city-corridors';
import { ribbonClearance } from './ribbon-clearance.test-support';
import { ribbonProfile } from '../walkway-network/ribbon-column';
import type { MovementGraph } from '../movement-network';
import { surveyTownWalk } from '../walkway-network';
import { houseStair } from '../../data/house-stair';
import type { Primitive, Vec3 } from '../parametrik/types';
import { expect, test } from 'bun:test';
import { required } from '../required';
import { openingScene, createWorld, cityCentreView, cityCorridorSite, type World } from './index';
import { openCity } from './city-opening';
import { surveyedGrid } from './town-grid';
import { walkingHeight } from './network-terrain';

function checkBench(
	p: Extract<Primitive, { kind: 'prism' }>,
	ground: (x: number, y: number) => number
) {
	const centre = p.polygon.reduce(
		([x, y], [u, v]) => [x + u / p.polygon.length, y + v / p.polygon.length],
		[0, 0]
	);
	for (const [i, a] of p.polygon.entries()) {
		const b = p.polygon[(i + 1) % p.polygon.length];
		for (let j = 0; j <= 4; j++)
			for (let k = 0; k <= 4 - j; k++) {
				const x = centre[0] + ((a[0] - centre[0]) * j) / 4 + ((b[0] - centre[0]) * k) / 4;
				const y = centre[1] + ((a[1] - centre[1]) * j) / 4 + ((b[1] - centre[1]) * k) / 4;
				const soil = ground(x, y);
				expect(p.z - soil).toBeLessThan(0.001);
				expect(p.z + p.height - soil).toBeGreaterThanOrEqual(0.049);
			}
	}
}

function checkConnected(graph: MovementGraph) {
	expect(graph.unresolved).toEqual([]);
	const neighbors = new Map(graph.ports.map((p) => [p.id, new Set<string>()]));
	for (const e of graph.edges) {
		neighbors.get(e.from)?.add(e.to);
		neighbors.get(e.to)?.add(e.from);
	}
	const visited = new Set([graph.ports[0].id]);
	for (const id of visited) for (const next of neighbors.get(id) ?? []) visited.add(next);
	expect(visited.size).toBe(graph.ports.length);
}

function checkColumns(
	path: Vec3[],
	id: string,
	parts: Map<string, Primitive>,
	ground: (x: number, y: number) => number
) {
	const stations = pathSupports(path, ribbonProfile.bay);
	for (const [i, [x, y, z]] of stations.entries()) {
		const base = ground(x, y);
		const height = z - ribbonProfile.depth - base;
		const pier = parts.get(id + '/pier/' + i);
		if (height <= 0.04) expect(pier).toBeUndefined();
		else {
			if (pier?.kind !== 'cylinder') throw Error('Missing column on ' + id);
			expect(pier.position[0]).toBeCloseTo(x, 7);
			expect(pier.position[1]).toBeCloseTo(y, 7);
			expect(pier.position[2]).toBeCloseTo(base, 7);
			expect(pier.height).toBeCloseTo(height, 7);
			expect(pier.radius).toBe(ribbonProfile.columnRadius);
		}
	}
}

function checkRibbon(mesh: Extract<Primitive, { kind: 'mesh' }>, world: World) {
	const gaps = ribbonClearance(mesh, world.grid);
	// At a court mouth the 0.60 m slab meets a bench graded up to 0.55 m above its base.
	expect(Number.isFinite(gaps.ground), mesh.id).toBe(true);
	expect(gaps.ground, mesh.id).toBeGreaterThanOrEqual(0.05 - 1e-7);
	expect(gaps.water, mesh.id).toBeGreaterThanOrEqual(1.8 - 1e-7);
	const path: Vec3[] = [];
	for (let i = 2; i < mesh.points.length; i += 4) {
		const a = mesh.points[i],
			b = mesh.points[i + 1];
		const centre: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]];
		const prev = path.at(-1);
		if (prev)
			expect(
				Math.abs(centre[2] - prev[2]) / Math.hypot(centre[0] - prev[0], centre[1] - prev[1])
			).toBeLessThanOrEqual(0.08 + 1e-7);
		path.push(centre);
	}
	return path;
}

function checkWalk(parts: Primitive[], world: World) {
	const { graph } = required(cityCorridorPlan(world), 'town ribbon').plan;
	checkConnected(graph);
	const members = new Map(parts.map((p) => [p.id, p]));
	const spans = graph.edges.filter((e) => e.kind === 'walkway' || e.kind === 'bridge');
	expect(spans.length).toBeGreaterThan(0);
	for (const e of spans) {
		const mesh = members.get(e.id + '/ramp');
		if (mesh?.kind !== 'mesh') throw Error('Missing walking surface on ' + e.id);
		checkColumns(checkRibbon(mesh, world), e.id, members, (x, y) =>
			walkingHeight(world.grid, x, y)
		);
	}
}

function checkTreadGoing(world: World) {
	const site = required(cityCorridorSite(world), 'city walk');
	const { spans, unresolved } = surveyTownWalk(...site, (x, y) =>
		walkingHeight(surveyedGrid(world.grid), x, y)
	);
	expect(unresolved).toEqual([]);
	const flights = spans.filter(
		({ a, b }) => Math.abs(b[2] - a[2]) > 0.08 * Math.hypot(a[0] - b[0], a[1] - b[1])
	);
	expect(flights.length).toBeGreaterThan(0);
	for (const { a, b, id } of flights) {
		const rise = Math.abs(b[2] - a[2]);
		const count = 1 + Math.ceil(rise / houseStair.rise);
		expect(Math.hypot(a[0] - b[0], a[1] - b[1]) / count, id).toBeGreaterThanOrEqual(
			houseStair.going - 1e-8
		);
	}
}

function checkSeats(world: World, ids: string[], ground: (x: number, y: number) => number) {
	for (const id of ids) {
		const c = required(world.grid.cellsById.get(id), 'house');
		if (c.raised) {
			expect(c.pad).toBe(
				required(surveyedGrid(world.grid).cellsById.get(id), 'surveyed parcel').pad
			);
			continue;
		}
		for (const [x, y] of c.lotCorners ?? c.corners)
			expect(c.pad - ground(x, y)).toBeLessThan(0.001);
	}
}
for (const [seed, terraceRows] of [
	[7, 4],
	[13, 4],
	[29, 4],
	[7, 2],
	[13, 8]
]) {
	test(
		'dry seats and public benches on seed ' + seed + ' with ' + terraceRows + ' terrace rows',
		() => {
			const world =
				terraceRows === 4
					? openingScene(seed).world
					: openCity(createWorld(seed, { plan: { terraceRows } }));
			const city = required(world.state.city, 'planned town');
			const ground = (x: number, y: number) => walkingHeight(world.grid, x, y);
			const parts = cityCentreView(world);
			checkWalk(parts, world);
			checkTreadGoing(world);
			const groups = city.centres.flatMap((c) => c.ensembles);
			expect(groups.length).toBeGreaterThan(0);
			for (const g of groups) {
				const p = parts.find((p) => p.id === 'court-lawn/' + g.court);
				if (p?.kind !== 'prism') throw Error('Missing court floor');
				checkBench(p, ground);
				checkSeats(world, g.lots, ground);
			}
		},
		60000
	);
}

test('the public route survey gives the path planner finished station and court elevations', () => {
	const world = openingScene(7).world;
	const [routes, station, courts, ground] = required(cityCorridorSite(world), 'route survey');
	const parts = cityCentreView(world);
	for (const id of new Set(routes.flat())) {
		const [x, y, z] = station(id);
		const cell = required(world.grid.cellsById.get(id), 'route parcel');
		expect([x, y]).toEqual(cell.center.slice(0, 2));
		expect(z).toBeGreaterThan(ground(x, y));
	}
	for (const court of courts) {
		const plate = parts.find((p) => p.id === 'court/' + court.id);
		if (plate?.kind !== 'prism') throw Error('Missing surveyed court');
		expect(court.position[2]).toBeCloseTo(plate.z + plate.height, 8);
	}
}, 60000);
