import type { Primitive } from '../parametrik/types';
import { expect, test } from 'bun:test';
import {
	applyEdit,
	cityCentreView,
	openingScene,
	prepareAdvance,
	regenerateHouse,
	type World
} from '../sandbox';
import { intersect, shoelaceArea } from '../parametrik/raster/geometry';
import { required } from '../required';
import { walkingPlates } from './town-survey.test-support';

type Face = ReturnType<typeof walkingPlates>[number];
type Vertex = Face['polygon'][number];

// Convex projected walking faces are neighbours when no edge separates their plan footprints.
function separated(a: Face, b: Face) {
	return a.polygon.some(([x, y], i) => {
		const [u, v] = a.polygon[(i + 1) % a.polygon.length];
		const distance = ([s, t]: Vertex) => (u - x) * (t - y) - (v - y) * (s - x);
		const own = a.polygon.map(distance),
			other = b.polygon.map(distance);
		const tolerance = 1e-6 * Math.hypot(u - x, v - y);
		return (
			Math.max(...own) < Math.min(...other) - tolerance ||
			Math.max(...other) < Math.min(...own) - tolerance
		);
	});
}
function isStep(face: Face) {
	return face.id.includes(':tread:') || face.id.includes('/step/');
}
function neighbours(face: Face, next: Face) {
	const rise = Math.abs(face.z + face.height - next.z - next.height);
	return (
		rise <= (isStep(face) || isStep(next) ? 0.21 : 0.02) &&
		!separated(face, next) &&
		!separated(next, face)
	);
}
function rampConnections(parts: Primitive[], faces: Face[]) {
	const links = new Map<Face, Set<Face>>();
	for (const part of parts) {
		if (part.kind !== 'mesh' || !part.id.endsWith('/ramp')) continue;
		const contacts = [0, 4].map((i) => {
			const edge = [part.points[i + 2], part.points[i + 3]];
			const polygon = edge.map(([x, y]): Vertex => [x, y]);
			return faces.filter(
				(f) => Math.abs(f.z + f.height - edge[0][2]) < 1e-7 && !separated(f, { ...f, polygon })
			);
		});
		for (const group of contacts) expect(group.length, part.id).toBeGreaterThan(0);
		for (const a of contacts[0])
			for (const b of contacts[1]) {
				const add = (u: Face, v: Face) => {
					const row = links.get(u) ?? new Set<Face>();
					row.add(v);
					links.set(u, row);
				};
				add(a, b);
				add(b, a);
			}
	}
	return links;
}
function components(faces: Face[], ramps: Map<Face, Set<Face>>) {
	const pending = new Set(faces);
	const groups: Face[][] = [];
	for (const start of pending) {
		const group = [start];
		pending.delete(start);
		for (const face of group) {
			for (const next of pending) {
				if (!ramps.get(face)?.has(next) && !neighbours(face, next)) continue;
				pending.delete(next);
				group.push(next);
			}
		}
		groups.push(group);
	}
	return groups;
}
function polygon(corners: readonly (readonly number[])[]) {
	const points = corners.map(([x, y]): Vertex => [x, y]);
	return shoelaceArea(points) < 0 ? points.reverse() : points;
}
function checkFootprints(world: World, reserved: Set<string>) {
	const roads = [...reserved].map((id) =>
		polygon(required(world.grid.cellsById.get(id), 'route').corners)
	);
	for (const id of world.state.stacks.keys()) {
		const lot = required(world.grid.cellsById.get(id), 'built footprint');
		const outline = polygon(lot.lotCorners ?? lot.corners);
		expect(
			roads.some((road) => Math.abs(shoelaceArea(intersect(outline, road))) > 1e-6),
			id
		).toBe(false);
	}
}
function inspect(world: World) {
	const city = required(world.state.city, 'town');
	const parts = cityCentreView(world),
		faces = walkingPlates(parts);
	const groups = components(faces, rampConnections(parts, faces));
	expect(
		groups.map((g) => g[0].id),
		groups.map((g) => g.length + ' at ' + g[0].id).join(', ')
	).toHaveLength(1);
	const connected = new Set(groups[0].map((p) => p.id));
	const reserved = new Set(city.walk.flat());
	for (const centre of city.centres) {
		for (const g of centre.ensembles) expect(connected.has('court/' + g.court)).toBe(true);
		for (const id of centre.lots) expect(reserved.has(id)).toBe(false);
	}
	for (const id of reserved) {
		expect(world.grid.cellsById.get(id)?.buildable).toBe(false);
		expect(world.state.stacks.has(id)).toBe(false);
	}
	checkFootprints(world, reserved);
	return reserved;
}
for (const seed of [7, 13, 29])
	test(
		'physical walk connectivity and protected lots through growth and edits on ' + seed,
		() => {
			let world = openingScene(seed).world;
			const city = required(world.state.city, 'town');
			expect(city.isolatedCentres).toEqual([]);
			expect(city.links).toHaveLength(city.centres.length - 1);
			const reserved = inspect(world);
			for (const id of reserved)
				expect(applyEdit(world, { kind: 'raise', cellId: id, use: 'food' })).toBe(world);
			for (let i = 0; i < 3; i++) {
				world = prepareAdvance(world).finish(new Map());
				inspect(world);
			}
			const plot = required(
				world.grid.cells.find(
					(c) => c.buildable && !world.state.stacks.has(c.id) && !world.state.cover.has(c.id)
				),
				'vacant lot'
			);
			world = applyEdit(world, { kind: 'raise', cellId: plot.id, use: 'food', style: 'composed' });
			expect(world.state.stacks.has(plot.id)).toBe(true);
			inspect(world);
			world = regenerateHouse(world, plot.id);
			expect(world.state.storyParts.get(plot.id)?.[0].houseSeed).toBeDefined();
			inspect(world);
		},
		60000
	);
