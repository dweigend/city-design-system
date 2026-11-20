import { assetRegistry } from '../assets';
import { townLife } from './town-life';
import { courtLife } from './court-life';
import { bounds, union, area as polygonArea } from '../ansicht/geometrie';
import { expect, test } from 'bun:test';
import { focuses } from '../presentation';
import { cityTransitSlots, lineParts } from '../transit-line';
import {
	openingScene,
	cityCentreView,
	houseGroups,
	installationView,
	spongeWorkView,
	type World
} from '../sandbox';
import { required } from '../required';
import { houseSurfaces } from '../composed-house';
import { type Primitive, type Vec3 } from '../parametrik/types';
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
	for (const [id, n] of degree)
		if (n === 3)
			expect(
				parts.filter(
					(p) => p.kind === 'sphere' && p.id.startsWith('town-walk/platform/' + id + '/meeting/')
				)
			).toHaveLength(3);
}

function checkTownPalette(world: World, parts: Primitive[]) {
	const token = houseSurfaces.access.token;
	const chunks = new Set(
		[...world.state.stacks.keys()].map(
			(id) => required(world.grid.cellsById.get(id), 'built plot').chunk
		)
	);
	const external = [
		...world.lines.flatMap((l) => lineParts(l, cityTransitSlots)),
		...installationView(world, 'all'),
		...(world.state.spongeWorks ?? []).flatMap((w) => spongeWorkView(world.grid, w)),
		...[...chunks].flatMap((chunk) => [...houseGroups(world, chunk, focuses.all).values()].flat())
	];
	for (const p of [...parts, ...external]) {
		expect(p.overprint).not.toBe(token);
		if (p.kind === 'prism') expect(p.topToken).not.toBe(token);
		if (p.token !== token) continue;
		expect(p.kind === 'prism' && p.id.startsWith('town-walk/')).toBe(true);
		const span = p.id.split(':tread:')[0];
		expect(parts.some((q) => q.id.startsWith(span + '/pier/'))).toBe(true);
	}
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
	return area;
}

function checkSupport(members: Primitive[], surfaces: Primitive[], feet: number) {
	const head = members.find((p) => p.kind === 'sphere');
	if (head?.kind !== 'sphere' || !head.id.includes('/kit-scatter-')) return;
	for (const p of members) {
		const { min, max } = bounds(p);
		for (const x of [min[0], max[0]])
			for (const y of [min[1], max[1]])
				expect(standsOn({ ...head, position: [x, y, feet + 1] }, surfaces, feet)).toBe(true);
	}
}

function footprintSupport(parts: Primitive[], surfaces: Primitive[]) {
	const objects = new Map<string, Primitive[]>();
	for (const p of parts.filter(
		(p) => p.id.includes('/kit-scatter-') || p.id.includes('/planter/rolled-lip-planter/')
	)) {
		const key = p.id.slice(0, p.id.lastIndexOf('/'));
		const members = objects.get(key) ?? [];
		members.push(p);
		objects.set(key, members);
	}
	const occupied: ReturnType<typeof union>[] = [];
	for (const members of objects.values()) {
		const box = union(members.map(bounds));
		for (const other of occupied)
			expect([0, 1].some((i) => box.min[i] >= other.max[i] || other.min[i] >= box.max[i])).toBe(
				true
			);
		occupied.push(box);
		checkSupport(members, surfaces, box.min[2]);
	}
}

function people(parts: Primitive[], pink: Primitive[], length: number, courts: Set<string>) {
	const surfaces = [
		...pink,
		...parts.filter(
			(p) =>
				p.id.startsWith('court/') ||
				p.id.startsWith('town-walk/platform/') ||
				p.id.startsWith('town-walk/joint/')
		)
	];
	footprintSupport(parts, surfaces);
	const heads = parts.filter((p) => p.kind === 'sphere' && p.id.includes('/kit-scatter-'));
	for (const head of heads) {
		const prefix = head.id.slice(0, head.id.lastIndexOf('/') + 1);
		const feet = Math.min(
			...parts.filter((p) => p.id.startsWith(prefix)).map((p) => bounds(p).min[2])
		);
		expect(head.kind === 'sphere' && standsOn(head, surfaces, feet)).toBe(true);
	}
	for (const id of courts) expect(heads.some((p) => p.id.startsWith(id + '/court/'))).toBe(true);
	const publicHeads = heads.filter((h) => h.id.includes('/life/'));
	expect(Math.abs(publicHeads.length - length / 20)).toBeLessThanOrEqual(1);
	for (const head of heads)
		expect(assetRegistry.some((a) => head.id.includes('/' + a.id + '/'))).toBe(true);
}

function courtOccupancy(parts: Primitive[], id: string, plate: Plate) {
	const groups = new Map<string, Primitive[]>();
	let count = 0;
	for (const part of parts.filter(
		(p) => p.id.startsWith(id + '/court/') || p.id.startsWith(id + '/feature/')
	)) {
		const key = part.id.slice(0, part.id.indexOf('/', id.length + 7));
		// The awning and bench share a single feature reservation.
		const owner = part.id.includes('/feature/') ? 'feature' : key;
		const group = groups.get(owner) ?? [];
		group.push(part);
		groups.set(owner, group);
		if (part.kind === 'sphere' && part.id.includes('/kit-scatter-')) count++;
	}
	expect(count).toBe(Math.max(3, Math.round(polygonArea(plate.polygon) / 17.5)));
	const boxes = [...groups.values()].map((group) => union(group.map(bounds)));
	for (const [i, a] of boxes.entries())
		for (const b of boxes.slice(i + 1))
			expect([0, 1].some((k) => a.max[k] <= b.min[k] || b.max[k] <= a.min[k])).toBe(true);
}

test('native plaza gatherings and deck lines fill carriers sized for their full parties', () => {
	for (const seed of [7, 13, 29]) {
		const polygon: [number, number][] = [
			[0, 0],
			[20, 0],
			[20, 20],
			[0, 20]
		];
		const figures = courtLife(
			{ id: 'square', polygon, area: 400, position: [10, 10, 2] },
			seed,
			false
		);
		for (const n of [7, 15])
			expect(
				figures.filter((p) => p.kind === 'sphere' && p.id.includes('kit-scatter-plaza-' + n + '/'))
			).toHaveLength(n);
		const spans = Array.from({ length: 40 }, (_, i) => ({
			id: 'route/' + i,
			a: [0, i * 5, 2] as Vec3,
			b: [20, i * 5, 2] as Vec3
		}));
		const walkers = townLife(spans, seed);
		for (const n of [3, 7, 15])
			expect(walkers.some((p) => p.id.includes('kit-scatter-group-' + n + '/'))).toBe(true);
		expect(walkers.filter((p) => p.kind === 'sphere' && p.id.includes('/life/'))).toHaveLength(40);
	}
});

function checkMeetings(parts: Primitive[], floor: Plate[], courts: Set<string>) {
	const heads = parts.filter((p) => p.kind === 'sphere' && p.id.includes('/kit-scatter-'));
	expect(heads.every((p) => p.token === '--ink' && p.finish === 'metall-graphit')).toBe(true);
	const near = (p: Primitive, at: Vec3) =>
		p.kind === 'sphere' &&
		Math.hypot(p.position[0] - at[0], p.position[1] - at[1]) <= 4.2 &&
		Math.abs(p.position[2] - at[2] - 1.5) < 0.4;
	const platforms = parts.filter(
		(p) =>
			p.kind === 'cylinder' && p.id.startsWith('town-walk/platform/') && !p.id.endsWith('/pier')
	);
	for (const p of platforms)
		expect(heads.filter((h) => h.id.startsWith(p.id + '/meeting/'))).toHaveLength(3);
	for (const p of floor.filter((p) => p.id.endsWith(':tread:0'))) {
		const key = p.id.slice(0, -1);
		const treads = floor.filter((q) => q.id.startsWith(key));
		for (const [t, i, j] of [
			[p, 0, 1],
			[treads[treads.length - 1], 2, 3]
		] as const) {
			const a = t.polygon[i],
				b = t.polygon[j];
			const at: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, t.z + t.height];
			expect(heads.filter((h) => near(h, at)).length).toBeGreaterThanOrEqual(3);
		}
	}
	checkGardens(parts, heads, courts);
}

function checkGardens(parts: Primitive[], heads: Primitive[], courts: Set<string>) {
	for (const id of courts) {
		expect(heads.filter((h) => h.id.startsWith(id + '/court/landing/'))).toHaveLength(3);
		const plate = parts.find((p) => p.id === 'court/' + id),
			bed = parts.find((p) => p.id === id + '/garden/bed');
		if (plate?.kind !== 'prism' || bed?.kind !== 'prism') throw Error('Missing garden plaza');
		expect(['beton-terrazzo', 'holz-natur']).toContain(plate.finish ?? '');
		expect(
			bed.polygon.filter((p) => plate.polygon.some((q) => q[0] === p[0] && q[1] === p[1]))
		).toHaveLength(2);
		expect(parts.some((p) => p.id.startsWith(id + '/garden/') && p.id.includes('park-tree-'))).toBe(
			true
		);
	}
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
			for (const id of courts) {
				const plate = parts.find((p) => p.id === 'court/' + id);
				expect(
					plate?.kind === 'prism' &&
						plate.height === 0.6 &&
						plate.token === houseSurfaces.deck.token
				).toBe(true);
				if (plate?.kind === 'prism') courtOccupancy(parts, id, plate);
				const assets = new Set(
					parts.filter((p) => p.id.startsWith(id + '/feature/')).map((p) => p.id.split('/').at(-2))
				);
				if (assets.has('kit-terrace-awning')) expect(assets.delete('kit-terrace-bench')).toBe(true);
				expect(assets.size).toBe(1);
			}
			checkTownPalette(world, parts);
			topology(city.walk, courts, parts);
			checkMeetings(parts, floor, courts);
			publicDeck(parts, pink, floor);
			const length = floor.reduce((sum, p) => sum + distance(p.polygon[0], p.polygon[3]), 0);
			people(parts, pink, length, courts);
			transit(world, floor);
			expect(cityCentreView(world)).toEqual(parts);
		},
		30000
	);
