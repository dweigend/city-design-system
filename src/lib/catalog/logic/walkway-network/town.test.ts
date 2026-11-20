import { bounds } from '../ansicht/geometrie';
import { expect, test } from 'bun:test';
import { openingScene, cityCentreView, type World } from '../sandbox';
import { required } from '../required';
import { houseSurfaces } from '../composed-house';
import { type Primitive } from '../parametrik/types';
import { distance, nearest, separation } from './clearance';
import type { Point } from './types';

const xy = (p: readonly number[]): Point => [p[0], p[1]];
type Plate = Extract<Primitive, { kind: 'prism' }>;
function standsOn(
	part: Extract<Primitive, { kind: 'sphere' }>,
	surfaces: Primitive[],
	feet: number
) {
	const [x, y, z] = part.position;
	return surfaces.some((p) => {
		if (p.kind !== 'prism' && p.kind !== 'cylinder') return false;
		const top = (p.kind === 'prism' ? p.z : p.position[2]) + p.height;
		if (Math.abs(top - feet) > 1e-7 || z <= top || z - top > 2) return false;
		if (p.kind !== 'prism') return distance([x, y], xy(p.position)) <= p.radius;
		const cross = p.polygon.map(([u, v], i) => {
			const [a, b] = p.polygon[(i + 1) % p.polygon.length];
			return (a - u) * (y - v) - (b - v) * (x - u);
		});
		return Math.min(...cross) >= -1e-7 || Math.max(...cross) <= 1e-7;
	});
}
function width(p: Plate) {
	return distance(p.polygon[0], p.polygon[1]);
}

function topology(walk: string[][], courts: Set<string>, parts: Primitive[]) {
	const degree = new Map<string, number>(),
		visited = new Set<string>();
	for (const [i, path] of walk.entries()) {
		expect(courts.has(path[0])).toBe(true);
		if (i) expect(visited.has(path[path.length - 1])).toBe(true);
		expect(path.slice(0, -1).every((id) => !visited.has(id))).toBe(true);
		for (const [j, id] of path.entries()) {
			visited.add(id);
			degree.set(id, (degree.get(id) ?? 0) + (j === 0 || j === path.length - 1 ? 1 : 2));
		}
		expect(
			parts.some((p) => p.id.startsWith('town-walk/' + path[0] + '>' + path[1] + ':tread:'))
		).toBe(true);
	}
	expect(
		[...degree]
			.filter(([, n]) => n === 1)
			.map(([id]) => id)
			.sort()
	).toEqual([...courts].sort());
	expect(Math.max(...degree.values())).toBe(3);
}

function publicDeck(parts: Primitive[], pink: Primitive[], floor: Plate[]) {
	const byId = new Map(parts.map((p) => [p.id, p]));

	expect(
		pink.every(
			(p) => p.id.startsWith('town-walk/') && (p.kind === 'prism' || p.kind === 'cylinder')
		)
	).toBe(true);

	for (const p of floor) {
		expect(width(p)).toBeCloseTo(2.5);
		expect(p.height).toBeLessThanOrEqual(0.25);
	}
	const spans = floor.filter((p) => !p.id.includes(':tread:'));
	let area = 0;
	for (const p of spans) {
		const run = distance(p.polygon[0], p.polygon[3]);
		expect(run).toBeLessThanOrEqual(25);
		area += run * width(p);
		for (const side of ['right', 'left']) {
			const rail = byId.get(p.id + '/' + side);
			if (rail?.kind !== 'pipe') throw Error('Missing handrail ' + p.id);
			expect(rail.radius * 2).toBeCloseTo(0.12);
			expect(rail.points[0][2] + rail.radius - p.z - p.height).toBeCloseTo(1.1);
		}
		const piers = parts.filter((q) => q.id.startsWith(p.id + '/pier/'));
		expect(piers.length).toBeGreaterThanOrEqual(Math.ceil(run / 12));
	}
	const planters = parts.filter(
		(p) => p.id.includes('/rolled-lip-planter/') && p.id.endsWith('/0')
	);
	expect(planters).toHaveLength(Math.floor(area / (2.5 * 30)));
	return area;
}

function people(parts: Primitive[], pink: Primitive[], area: number, count: number) {
	const surfaces = [...pink, ...parts.filter((p) => p.id.startsWith('court/'))];
	const heads = parts.filter((p) => p.kind === 'sphere' && p.id.includes('/person-'));
	for (const head of heads) {
		const prefix = head.id.slice(0, head.id.lastIndexOf('/') + 1);
		const feet = Math.min(
			...parts.filter((p) => p.id.startsWith(prefix)).map((p) => bounds(p).min[2])
		);
		expect(head.kind === 'sphere' && standsOn(head, surfaces, feet)).toBe(true);
	}
	const walkers = heads.filter((h) => h.id.includes('person-walking')).length;
	expect(Math.abs(walkers - heads.length / 3)).toBeLessThanOrEqual(count + 2);
	const publicHeads = heads.filter((h) => h.id.includes('/life/')).length;
	expect(area / publicHeads).toBeGreaterThanOrEqual(15);
	expect(area / publicHeads).toBeLessThanOrEqual(20);
}

function transit(world: World, floor: Plate[]) {
	const lines = world.lines.filter((l) => l.kind === 'viaduct');
	expect(lines.length).toBeGreaterThan(0);
	const stock = [...world.state.storyParts]
		.filter(([, parts]) => parts[0].id.startsWith('p/0/'))
		.map(([id]) => required(world.grid.cellsById.get(id), 'stock'));
	for (const line of lines) {
		const a = xy(line.path[0]),
			b = xy(line.path[line.path.length - 1]);
		for (const p of floor)
			for (const [i, c] of p.polygon.entries()) {
				const d = p.polygon[(i + 1) % 4];
				expect(separation({ a, b }, { a: c, b: d })).toBeGreaterThanOrEqual(6);
			}
		for (const cell of stock) {
			const radius = Math.min(...cell.corners.map((p) => distance(xy(p), xy(cell.center))));
			expect(distance(xy(cell.center), nearest(xy(cell.center), { a, b }))).toBeGreaterThan(
				radius / 2
			);
			for (const [i, p] of cell.corners.entries())
				expect(
					separation({ a, b }, { a: xy(p), b: xy(cell.corners[(i + 1) % 4]) })
				).toBeGreaterThan(0);
		}
	}
}

for (const seed of [7, 13, 29])
	test(
		'public court tree, deck furniture and transit on seed ' + seed,
		() => {
			const { world } = openingScene(seed),
				city = required(world.state.city, 'city');
			const parts = cityCentreView(world),
				pink = parts.filter((p) => p.token === houseSurfaces.access.token);
			const courts = new Set(city.centres.flatMap((c) => c.ensembles.map((g) => g.court)));
			const floor = pink.filter((p) => p.kind === 'prism');
			for (const id of courts)
				expect(parts.some((p) => p.id.startsWith(id + '/bench/backrest-bench/'))).toBe(true);
			topology(city.walk, courts, parts);
			people(parts, pink, publicDeck(parts, pink, floor), courts.size);
			transit(world, floor);
			expect(cityCentreView(world)).toEqual(parts);
		},
		30000
	);
