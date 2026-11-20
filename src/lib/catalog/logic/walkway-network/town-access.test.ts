import { surveyedWalk } from './town-survey.test-support';
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
import { interpolatePoint, type Primitive } from '../parametrik/types';
type Plate = Extract<Primitive, { kind: 'prism' }>;
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
	const decks = parts.filter((p) => p.kind === 'mesh' && ramp(p));
	expect(decks.length).toBeGreaterThan(0);
	for (const landing of surveyedWalk(world).ends.values()) {
		const touches = decks.some(
			(p) =>
				p.kind === 'mesh' &&
				[0, p.points.length - 4].some((i) => {
					const [x, y, z] = interpolatePoint(p.points[i + 2], p.points[i + 3], 0.5);
					return Math.hypot(x - landing[0], y - landing[1], z - landing[2]) < 1e-6;
				})
		);
		expect(touches, 'court threshold ' + landing).toBe(true);
	}
	expect(walk.every((p) => p.id.startsWith('town-walk/joint/'))).toBe(true);
	expect(
		parts.some((p) => p.id.startsWith('town-walk/') && /:tread:|\/girder|\/platform\//.test(p.id))
	).toBe(false);
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
