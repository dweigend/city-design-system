import { expect, test } from 'bun:test';
import { circulation, houseSurfaces } from '../composed-house';
import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
import { cellAtPoint } from '../terrain-grid';
import type { Solid } from '../house-typology';
import { bounds } from '../ansicht/geometrie';
import { required } from '../required';
import { applyEdit, createWorld, changes, type World } from './index';
import { composedProjection, townSections } from './composed-projection';
import { intersect, shoelaceArea } from '../parametrik/raster/geometry';
import { prismFaces } from '../house-typology/prism';
import type { Point2 } from '../ansicht/geometrie';

const networks = (w: World) => composedProjection(w).filter((g) => g.id.startsWith('network/'));
const paint = (w: World, id: string) => applyEdit(w, { kind: 'raise', cellId: id, use: 'living' });
const midpoint = (a: Vec3, b: Vec3) => interpolatePoint(a, b, 0.5);
const key = ([x, y]: Vec3) => [x.toFixed(6), y.toFixed(6)].join(',');
const strips = (parts: Primitive[]) =>
	parts.filter((p) => p.kind === 'mesh').filter((p) => !p.id.includes('/people/'));
type Sheet = ReturnType<typeof strips>[number];

function topology(deck: Sheet[]) {
	const neighbors = new Map<string, Set<string>>();
	for (const {
		points: [a, b, c, d]
	} of deck) {
		const u = key(midpoint(a, b)),
			v = key(midpoint(c, d));
		for (const [from, to] of [
			[u, v],
			[v, u]
		]) {
			const next = neighbors.get(from) ?? new Set<string>();
			next.add(to);
			neighbors.set(from, next);
		}
	}
	const seen = new Set([required(neighbors.keys().next().value, 'first station')]);
	for (const id of seen) for (const next of neighbors.get(id) ?? []) seen.add(next);
	expect(seen.size).toBe(neighbors.size);
	expect(deck.length).toBe(seen.size - 1);
	return seen;
}

function clearTerrain(world: World, deck: Sheet[]) {
	for (const { points } of deck)
		for (const [x, y] of [...points, midpoint(points[0], points[2])]) {
			const c = required(cellAtPoint(world.grid, x, y), 'deck on grid');
			if (c.zone !== 'water' && world.state.cover.get(c.id) !== 'forest') continue;
			// A strip can be tangent to a blocked cell; terrain picking assigns its shared edge to either owner.
			const depth = c.corners.map(([u, v], i) => {
				const [a, b] = c.corners[(i + 1) % 4];
				return ((a - u) * (y - v) - (b - v) * (x - u)) / Math.hypot(a - u, b - v);
			});
			expect(Math.min(...depth)).toBeLessThan(1e-7);
		}
}

function houseClearance(world: World, deck: Sheet[], stations: Set<string>) {
	const { sections } = townSections(world);
	for (const house of sections) {
		const foot = required(circulation(house).stops.at(-1), 'stair foot');
		expect(stations.has(key(foot))).toBe(true);
		for (const body of house.composition.parts.filter((p) => p.joint === 'body')) {
			if (body.kind !== 'prism') throw Error('Expected surveyed occupied footprint');
			clearRoom(body, deck);
		}
	}
}

function clearRoom(body: Extract<Solid, { kind: 'prism' }>, deck: Sheet[]) {
	const faces = prismFaces([body.polygon, ...(body.holes ?? [])]);
	for (const strip of deck) {
		const outline = walkingBand(strip.points, body.z, body.z + body.height);
		if (outline.length < 3) continue;
		for (const face of faces)
			expect(
				Math.abs(shoelaceArea(intersect(outline, face))),
				body.id + ' / ' + strip.id
			).toBeLessThan(1e-7);
	}
}

// Clip the clear walking volume at the floor and ceiling before testing plan overlap.
function walkingBand(points: Vec3[], bottom: number, top: number): Point2[] {
	function clip(ring: Vec3[], height: number, sign: number) {
		const kept: Vec3[] = [];
		for (const [i, a] of ring.entries()) {
			const b = ring[(i + 1) % ring.length];
			const da = sign * (a[2] - height),
				db = sign * (b[2] - height);
			if (da > 0) kept.push(a);
			if (da * db < 0) kept.push(interpolatePoint(a, b, da / (da - db)));
		}
		return kept;
	}
	return clip(clip(points, bottom - 2.1, 1), top, -1).map(([x, y]) => [x, y]);
}

function peopleOnDeck(parts: Primitive[], deck: Sheet[]) {
	const figures = new Map<string, Primitive[]>();
	for (const p of parts) {
		const id = p.id.match(/.*\/people\/\d+/)?.[0];
		if (id) figures.set(id, [...(figures.get(id) ?? []), p]);
	}
	const centers = deck.map((s) => midpoint(s.points[0], s.points[2]));
	const span = deck.reduce((sum, { points: [a, b, c, d] }) => {
		const p = midpoint(a, b),
			q = midpoint(c, d);
		return sum + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
	}, 0);
	expect(figures.size).toBeGreaterThanOrEqual(Math.max(1, Math.ceil(span / 20)));
	expect(figures.size).toBeLessThanOrEqual(Math.max(1, Math.ceil((3 * span) / 20)));
	for (const figure of figures.values()) {
		const boxes = figure.map(bounds);
		const foot = Math.min(...boxes.map((b) => b.min[2]));
		const min = [0, 1].map((i) => Math.min(...boxes.map((b) => b.min[i])));
		const max = [0, 1].map((i) => Math.max(...boxes.map((b) => b.max[i])));
		expect(
			centers.some(
				([x, y, z]) =>
					Math.abs(z - foot) < 0.02 && x >= min[0] && x <= max[0] && y >= min[1] && y <= max[1]
			)
		).toBe(true);
	}
}

function inspect(world: World, count: number) {
	const groups = networks(world);
	expect(groups).toHaveLength(1);
	expect(groups[0].owners).toHaveLength(count);
	const parts = groups[0].parts(),
		deck = strips(parts);
	expect(deck.every((p) => p.token === houseSurfaces.access.token)).toBe(true);
	const stations = topology(deck);
	houseClearance(world, deck, stations);
	clearTerrain(world, deck);
	peopleOnDeck(parts, deck);
}

for (const seed of [7, 13, 29, 41])
	test('3–12 painted houses on terrain seed ' + seed, () => {
		let world = createWorld(seed, { cells: 0 });
		for (let i = 0; i < 12; i++) {
			world = paint(world, 30 + 2 * (i % 4) + '/' + (30 + 2 * Math.floor(i / 4)));
			if (i >= 2) inspect(world, i + 1);
		}
	});

test('a forest stroke reroutes the ground deck and clearing restores it', () => {
	const w = ['30/30', '32/30', '34/30'].reduce(paint, createWorld(7, { cells: 0 }));
	const forest = applyEdit(w, { kind: 'cover', cover: 'forest', cellId: '31/30' });
	expect(forest.state.cover.get('31/30')).toBe('forest');
	const [before] = networks(w),
		[after] = networks(forest);
	expect(after.span).not.toBe(before.span);
	expect(changes(w, forest).houseGroups.has('composed/' + after.id)).toBe(true);
	inspect(forest, 3);
	const cleared = applyEdit(forest, { kind: 'clear', cellId: '31/30' });
	expect(networks(cleared)[0].parts()).toEqual(before.parts());
});

test('shoreline houses keep their deck on land next to water', () => {
	const world = ['30/20', '32/20', '34/20'].reduce(paint, createWorld(7, { cells: 0 }));
	expect(world.grid.cellsById.get('30/19')?.zone).toBe('water');
	inspect(world, 3);
});

test('painting and erasing reuse the remote tree and replay from seed reproduces it', () => {
	const ids = ['30/30', '32/30', '34/30', '50/30', '52/30', '54/30'];
	const w = ids.reduce(paint, createWorld(7, { cells: 0 }));
	const original = networks(w);
	expect(original).toHaveLength(2);
	const remote = original[1],
		more = paint(w, '36/30');
	const less = applyEdit(more, { kind: 'clear', cellId: '36/30' });
	for (const next of [more, less]) {
		expect(networks(next)[1].parts).toBe(remote.parts);
		expect(JSON.stringify(networks(next)[1].parts())).toBe(JSON.stringify(remote.parts()));
	}
	expect(networks(less)[0].parts()).toEqual(original[0].parts());
	const replay = ids.reduce(paint, createWorld(7, { cells: 0 }));
	expect(networks(replay).map((g) => g.parts())).toEqual(original.map((g) => g.parts()));
});
