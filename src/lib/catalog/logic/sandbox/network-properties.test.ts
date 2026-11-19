import { expect, test } from 'bun:test';
import { circulation, paintedSections, houseSurfaces } from '../composed-house';
import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
import { cellAtPoint } from '../terrain-grid';
import { required } from '../required';
import { applyEdit, createWorld, changes, type World } from './index';
import { composedProjection } from './composed-projection';
import { buildingPlots } from './building-plots';
import { houseDistrict } from './house-ensembles';

const networks = (w: World) => composedProjection(w).filter((g) => g.id.startsWith('network/'));
const paint = (w: World, id: string) => applyEdit(w, { kind: 'raise', cellId: id, use: 'living' });
const midpoint = (a: Vec3, b: Vec3) => interpolatePoint(a, b, 0.5);
const key = ([x, y]: Vec3) => [x.toFixed(6), y.toFixed(6)].join(',');
const strips = (parts: Primitive[]) => parts.filter((p) => p.kind === 'mesh');
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
	const houses = paintedSections(buildingPlots(world.grid), world.state.stacks, world.seed, {
		district: (id) => houseDistrict(required(world.grid.cellsById.get(id), 'painted cell'))
	});
	for (const house of houses) {
		const foot = required(circulation(house).stops.at(-1), 'stair foot');
		expect(stations.has(key(foot))).toBe(true);
		for (const body of house.composition.levels.flatMap((l) => l.bodies)) {
			const [w, d] =
				Math.abs(Math.sin(body.rotation)) > 0.5 ? [body.size[1], body.size[0]] : body.size;
			for (const {
				points: [a, b, c, e]
			} of deck) {
				const from = midpoint(a, b),
					to = midpoint(c, e);
				expect(cutsBody(from, to, body.position, [w, d])).toBe(false);
			}
		}
	}
}

// Clip a complete centreline section against the open interior of the physical body footprint.
function cutsBody(a: Vec3, b: Vec3, center: Vec3, size: number[]) {
	let low = 0,
		high = 1;
	for (const i of [0, 1]) {
		const delta = b[i] - a[i],
			half = size[i] / 2 - 1e-6,
			offset = center[i] - a[i];
		if (Math.abs(delta) < 1e-10) {
			if (Math.abs(offset) >= half) return false;
			continue;
		}
		const t = (offset - half) / delta,
			u = (offset + half) / delta;
		low = Math.max(low, Math.min(t, u));
		high = Math.min(high, Math.max(t, u));
	}
	return low < high;
}

function peopleOnDeck(parts: Primitive[], deck: Sheet[]) {
	const legs = parts.filter(
		(p) => p.kind === 'capsule' && p.id.includes('/person-') && /\/(3|5)$/.test(p.id)
	);
	const centers = deck.map((s) => midpoint(s.points[0], s.points[2]));
	const span = deck.reduce((sum, { points: [a, b, c, d] }) => {
		const p = midpoint(a, b),
			q = midpoint(c, d);
		return sum + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
	}, 0);
	expect(legs.length / 2).toBeGreaterThanOrEqual(Math.max(1, Math.ceil(span / 20)));
	expect(legs.length / 2).toBeLessThanOrEqual(Math.max(1, Math.ceil((3 * span) / 20)));
	for (let i = 0; i < legs.length; i += 2) {
		const a = legs[i],
			b = legs[i + 1];
		if (a.kind !== 'capsule' || b.kind !== 'capsule') throw Error('Missing registry legs');
		const feet = midpoint(a.to, b.to);
		feet[2] -= a.radius;
		expect(centers.some((p) => Math.hypot(...p.map((v, k) => v - feet[k])) < 1e-7)).toBe(true);
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

for (const seed of [7, 29, 41])
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
