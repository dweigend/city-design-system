import { ribbonProfile } from './ribbon-column';
import { ribbonQuads, surveyedWalk, walkingPlates } from './town-survey.test-support';
import { assetRegistry } from '../assets';
import { townLife } from './town-life';
import { courtLife } from './court-life';
import { bounds, union } from '../ansicht/geometrie';
import { expect, test } from 'bun:test';
import { openingScene, cityCentreView, type World } from '../sandbox';
import { required } from '../required';
import { houseSurfaces } from '../composed-house';
import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
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
function topology(walk: string[][], courts: Set<string>) {
	const degree = new Map<string, number>(),
		edges = new Set<string>();
	for (const path of walk) {
		for (let i = 1; i < path.length; i++) {
			const a = path[i - 1],
				b = path[i],
				key = [a, b].sort().join('>');
			expect(edges.has(key)).toBe(false);
			edges.add(key);
			degree.set(a, (degree.get(a) ?? 0) + 1);
			degree.set(b, (degree.get(b) ?? 0) + 1);
		}
	}
	for (const id of courts) {
		expect(degree.get(id)).toBe(1);
	}
	expect(Math.max(...degree.values())).toBeLessThanOrEqual(3);
}

function publicDeck(parts: Primitive[], pink: Primitive[]) {
	const rails = parts.filter((p) => p.kind === 'pipe' && p.id.startsWith('town-walk/rail/'));
	expect(rails.length).toBeGreaterThan(0);
	for (const rail of rails)
		if (rail.kind === 'pipe') expect(rail.radius).toBe(ribbonProfile.railRadius);
	expect(
		pink.every(
			(p) =>
				p.id.startsWith('town-walk/') &&
				(p.id.endsWith('/ramp') || p.id.startsWith('town-walk/joint/'))
		)
	).toBe(true);
	expect(
		parts.filter(
			(p) => p.id.startsWith('town-walk/') && /platform|:tread:|girder|planter/.test(p.id)
		)
	).toEqual([]);
}
function checkSupport(members: Primitive[], surfaces: Primitive[], feet: number) {
	const head = members.find((p) => p.kind === 'sphere');
	if (head?.kind !== 'sphere' || !head.id.includes('/kit-scatter-')) return;
	for (const p of members) {
		const { min, max } = bounds(p);
		for (const x of [min[0], max[0]])
			for (const y of [min[1], max[1]])
				expect(
					standsOn({ ...head, position: [x, y, feet + 1] }, surfaces, feet),
					p.id + ' at ' + [x, y, feet].join(',')
				).toBe(true);
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

function people(parts: Primitive[], courts: Set<string>) {
	const surfaces = walkingPlates(parts);
	footprintSupport(
		parts.filter((p) => !p.id.includes('/life/')),
		surfaces
	);
	const heads = parts.filter(
		(p) => p.kind === 'sphere' && p.id.includes('/kit-scatter-') && !p.id.includes('/life/')
	);
	for (const head of heads) {
		const prefix = head.id.slice(0, head.id.lastIndexOf('/') + 1);
		const feet = Math.min(
			...parts.filter((p) => p.id.startsWith(prefix)).map((p) => bounds(p).min[2])
		);
		expect(head.kind === 'sphere' && standsOn(head, surfaces, feet)).toBe(true);
	}
	for (const id of courts) expect(heads.some((p) => p.id.startsWith(id + '/court/'))).toBe(true);
	const walkers = parts.filter((p) => p.kind === 'sphere').filter((p) => p.id.includes('/life/'));
	expect(walkers.length).toBeWithin(1, 9);
	const decks = parts.filter((p) => p.kind === 'mesh' && p.id.endsWith('/ramp'));
	for (const [i, walker] of walkers.entries()) {
		expect(decks.some((deck) => walker.id.startsWith(deck.id.slice(0, -5) + '/life/'))).toBe(true);
		for (const other of walkers.slice(i + 1))
			expect(distance(xy(walker.position), xy(other.position))).toBeGreaterThanOrEqual(17.5);
	}

	for (const head of heads)
		expect(assetRegistry.some((a) => head.id.includes('/' + a.id + '/'))).toBe(true);
}

function courtOccupancy(parts: Primitive[], id: string, area: number) {
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
	expect(count).toBe(Math.min(2, Math.max(1, Math.round(area / 120))));
	const boxes = [...groups.values()].map((group) => union(group.map(bounds)));
	for (const [i, a] of boxes.entries())
		for (const b of boxes.slice(i + 1))
			expect([0, 1].some((k) => a.max[k] <= b.min[k] || b.max[k] <= a.min[k])).toBe(true);
}

test('small court parties and spaced route walkers use native figures', () => {
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
		expect(
			figures.filter((p) => p.kind === 'sphere' && p.id.includes('/kit-scatter-'))
		).toHaveLength(2);
		const walkers = townLife(
			[
				{
					id: 'route',
					path: [
						[0, 0, 2],
						[80, 0, 2],
						[120, 0, 2]
					]
				}
			],
			[],
			seed
		);
		expect(walkers.filter((p) => p.kind === 'sphere')).toHaveLength(2);
	}
});

function checkCourtDock(parts: Primitive[], rim: Plate, landing: Vec3) {
	const ends = parts.flatMap((p) =>
		p.kind === 'mesh' && p.id.startsWith('town-walk/') && p.id.endsWith('/ramp')
			? [0, p.points.length - 4].map((i) => [p.points[i + 2], p.points[i + 3]])
			: []
	);
	const [left, right] = required(
		ends.find(([a, b]) => distance(xy(interpolatePoint(a, b, 0.5)), xy(landing)) < 1e-7),
		'ribbon end at ' + rim.id
	);
	for (const height of [rim.z + rim.height, left[2], right[2]])
		expect(height).toBeCloseTo(landing[2], 7);
	expect(distance(xy(left), xy(right))).toBeCloseTo(ribbonProfile.width, 7);
	expect(
		rim.polygon.some((a, i) => {
			const edge = { a, b: rim.polygon[(i + 1) % rim.polygon.length] };
			return [xy(left), xy(right)].every((p) => distance(p, nearest(p, edge)) < 1e-7);
		})
	).toBe(true);
}

function checkGardens(
	parts: Primitive[],
	heads: Primitive[],
	survey: ReturnType<typeof surveyedWalk>
) {
	for (const { id, polygon } of survey.courts) {
		expect(heads.filter((h) => h.id.startsWith(id + '/court/landing/'))).toHaveLength(1);
		const plate = parts.find((p) => p.id === 'court/' + id),
			bed = parts.find((p) => p.id === id + '/garden/bed');
		if (plate?.kind !== 'prism' || bed?.kind !== 'prism') throw Error('Missing garden plaza');
		expect(polygon.every((p, i) => distance(p, polygon[(i + 1) % polygon.length]) >= 12)).toBe(
			true
		);
		checkCourtDock(parts, plate, required(survey.ends.get(id), 'court landing'));
		const steps = parts.filter(
			(p): p is Plate => p.kind === 'prism' && p.id.startsWith(plate.id + '/step/')
		);
		expect(steps).toHaveLength(0);
		const trees = new Set(
			parts
				.filter((p) => p.id.startsWith(id + '/garden/') && p.id.includes('park-tree-'))
				.map((p) => p.id.split('/garden/')[1].split('/')[0])
		);
		expect([3, 4]).toContain(trees.size);
		expect(['beton-terrazzo', 'beton-schalung']).toContain(plate.finish ?? '');
		expect(
			bed.polygon.filter((p) => polygon.some((q) => q[0] === p[0] && q[1] === p[1]))
		).toHaveLength(2);
		expect(parts.some((p) => p.id.startsWith(id + '/garden/') && p.id.includes('park-tree-'))).toBe(
			true
		);
	}
}

function transit(world: World, floor: { polygon: Point[] }[]) {
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
				const d = p.polygon[(i + 1) % p.polygon.length];
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

			const survey = surveyedWalk(world);
			for (const { id, area } of survey.courts) {
				const plate = parts.find((p) => p.id === 'court/' + id);
				const lawn = parts.find((p) => p.id === 'court-lawn/' + id);
				if (plate?.kind !== 'prism' || lawn?.kind !== 'prism') throw Error('Missing court surface');
				expect(plate.token).toBe('--cat-nature-2');
				expect(plate.height).toBeGreaterThan(0);
				expect(plate.height).toBeLessThan(lawn.height);
				expect(plate.holes).toEqual([lawn.polygon]);
				expect(plate.z + plate.height).toBeCloseTo(lawn.z + lawn.height, 7);
				courtOccupancy(parts, id, area);
				const assets = new Set(
					parts.filter((p) => p.id.startsWith(id + '/feature/')).map((p) => p.id.split('/').at(-2))
				);
				if (assets.has('kit-terrace-awning')) expect(assets.delete('kit-terrace-bench')).toBe(true);
				expect(assets.size).toBe(1);
			}

			topology(city.walk, courts);
			checkGardens(
				parts,
				parts.filter((p) => p.kind === 'sphere'),
				survey
			);
			publicDeck(parts, pink);
			const runs = survey.spans.map((s) => ({
				id: s.id,
				length: distance(xy(s.a), xy(s.b))
			}));

			// Measured projected walk lengths before the centre greens were introduced.
			const original = new Map([
				[7, 491.5365],
				[13, 390.9511],
				[29, 563.1497]
			]);
			const linkSpans = new Set(
				city.links.flatMap((path) =>
					path.slice(1).map((id, i) => 'town-walk/' + path[i] + '>' + id)
				)
			);
			const internalLength = runs.reduce(
				(sum, p) =>
					linkSpans.has(p.id.split(':')[0].replace(/\/stair$/, '')) ? sum : sum + p.length,
				0
			);
			expect(internalLength).toBeLessThan(required(original.get(seed), 'reference length'));
			people(parts, courts);
			transit(
				world,
				ribbonQuads(parts).map((q) => ({ polygon: q.points.map(xy) }))
			);
			expect(cityCentreView(world)).toEqual(parts);
		},
		30000
	);
