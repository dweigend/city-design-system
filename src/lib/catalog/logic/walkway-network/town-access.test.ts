import { surveyedWalk, walkingPlates } from './town-survey.test-support';
import { test, expect } from 'bun:test';
import {
	cityCentreView,
	houseGroups,
	installationView,
	spongeWorkView,
	openingScene,
	acceptanceScene,
	prepareAdvance,
	applyEdit,
	regenerateHouse,
	type World
} from '../sandbox';
import { focuses } from '../presentation';
import { cityTransitSlots, lineParts } from '../transit-line';
import { houseSurfaces } from '../composed-house';
import { required } from '../required';
import { townPath } from './town-path';
import { needsTreads } from './walking-profile';
import { interpolatePoint, type Primitive, type Vec3 } from '../parametrik/types';
type Plate = Extract<Primitive, { kind: 'prism' }>;
type Point = [number, number];
function contains(p: Plate, [x, y]: Point) {
	const sides = p.polygon.map(([a, b], i) => {
		const [c, d] = p.polygon[(i + 1) % p.polygon.length];
		return ((c - a) * (y - b) - (d - b) * (x - a)) / Math.hypot(c - a, d - b);
	});
	return Math.min(...sides) >= -0.000001 || Math.max(...sides) <= 0.000001;
}
function contacts(q: Vec3, part: Primitive) {
	if (part.kind === 'prism')
		return Math.abs(q[2] - part.z - part.height) <= 0.02 && contains(part, [q[0], q[1]]);
	if (part.kind !== 'cylinder') return false;
	const [x, y, z] = part.position;
	return (
		Math.abs(q[2] - z - part.height) <= 0.02 && Math.hypot(q[0] - x, q[1] - y) <= part.radius + 1e-7
	);
}
function rampEnd(p: Primitive, q: Vec3) {
	if (p.kind !== 'mesh' || !p.id.endsWith('/ramp')) return false;
	return [0, 4].some((i) => {
		const a = p.points[i + 2],
			b = p.points[i + 3],
			d = Math.hypot(a[0] - b[0], a[1] - b[1]);
		return (
			Math.abs(q[2] - a[2]) < 1e-7 &&
			Math.abs(Math.hypot(q[0] - a[0], q[1] - a[1]) + Math.hypot(q[0] - b[0], q[1] - b[1]) - d) <
				1e-7
		);
	});
}
function attachedStairs(parts: Primitive[], world: World) {
	const carriers = walkingPlates(parts),
		{ spans, stations } = surveyedWalk(world);
	const forks = new Map(
		[...stations].filter(([, s]) => s.arms.length === 3).map(([id, s]) => [id, s.position])
	);
	for (const { span, left, right } of townPath(spans, forks).bands.filter((b) =>
		needsTreads(b.span.a, b.span.b)
	)) {
		for (const i of [0, left.length - 1]) {
			const a = left[i],
				b = right[i === 0 ? 0 : right.length - 1];
			const q = interpolatePoint(a, b, 0.5);
			expect(
				carriers.some((p) => !p.id.startsWith(span.id + ':tread:') && contacts(q, p)) ||
					parts.some((p) => rampEnd(p, q)),
				span.id + ' unattached at ' + q.join(',')
			).toBe(true);
		}
	}
}
function externalParts(world: World) {
	const chunks = new Set(
		[...world.state.stacks.keys()].map(
			(id) => required(world.grid.cellsById.get(id), 'built plot').chunk
		)
	);
	return [
		...world.lines.flatMap((l) => lineParts(l, cityTransitSlots)),
		...installationView(world, 'all'),
		...(world.state.spongeWorks ?? []).flatMap((w) => spongeWorkView(world.grid, w)),
		...[...chunks].flatMap((chunk) => [...houseGroups(world, chunk, focuses.all).values()].flat())
	];
}
function checkTownPalette(world: World, parts: Primitive[]) {
	const walk = accessPlates([...parts, ...externalParts(world)]);
	const faces = walkingPlates(parts);
	const supports = parts.filter(
		(p): p is Extract<Primitive, { radius: number; height: number }> & { kind: 'cylinder' } =>
			p.kind === 'cylinder' && p.id.includes('/pier')
	);
	for (const deck of walk.filter((p) => !p.id.includes(':tread:'))) {
		const owner = deck.id.split('/panel/')[0];
		expect(
			supports.some(
				(p) =>
					p.id.startsWith(owner + '/pier') &&
					Math.abs(p.position[2] + p.height - deck.z) <= 0.02 &&
					faces.some((q) => contacts([p.position[0], p.position[1], deck.z + deck.height], q))
			),
			owner
		).toBe(true);
	}
	expect(walk.length).toBeGreaterThan(0);
	attachedStairs(parts, world);
	expect(world.grid.cells.some((c) => c.plan.stairAlley)).toBe(false);
}
function ramp(p: Primitive) {
	return p.kind === 'mesh' && p.id.startsWith('town-walk/') && p.id.endsWith('/ramp');
}
function accessPlates(parts: Primitive[]) {
	const token = houseSurfaces.access.token;
	const walk: Plate[] = [];
	for (const p of parts) {
		if (p.overprint === token || (p.kind === 'prism' && p.topToken === token))
			throw Error('Access print ' + p.id);
		if (p.token !== token) continue;
		if (ramp(p)) continue;
		if (p.kind !== 'prism' || !p.id.startsWith('town-walk/'))
			throw Error('Detached access ' + p.id);
		walk.push(p);
	}
	return walk;
}
for (const seed of [7, 13, 29])
	test(
		'attached access through growth, painting and regeneration on ' + seed,
		() => {
			const reference = acceptanceScene(seed);
			checkTownPalette(reference.world, [
				...cityCentreView(reference.world),
				...reference.additions
			]);
			let world = openingScene(seed).world;
			const inspect = () => checkTownPalette(world, cityCentreView(world));
			inspect();
			for (let i = 0; i < 3; i++) {
				world = prepareAdvance(world).finish(new Map());
				inspect();
			}
			const cell = required(
				world.grid.cells.find(
					(c) => c.buildable && !world.state.stacks.has(c.id) && !world.state.cover.has(c.id)
				),
				'empty paintable plot'
			);
			const id = cell.id;
			world = applyEdit(world, { kind: 'raise', cellId: id, use: 'food', style: 'composed' });
			expect(world.state.stacks.get(id)?.length).toBe(1);
			inspect();
			world = regenerateHouse(world, id);
			expect(world.state.storyParts.get(id)?.[0].houseSeed).toBeDefined();
			inspect();
		},
		60000
	);
