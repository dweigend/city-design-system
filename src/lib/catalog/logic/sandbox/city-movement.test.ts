import { area, type Point2 } from '../ansicht/geometrie';
import { findMovementPath } from '../movement-network';
import { intersect } from '../parametrik/raster/geometry';
import { deckCorners } from '../walkway';
import { required } from '../required';
import { test, expect } from 'bun:test';
import {
	acceptanceScene,
	cityCentreView,
	cityMovementNetwork,
	composedProjection,
	openingScene
} from './index';
import { cityCorridorPlan } from './city-corridors';
import { townSections } from './composed-projection';

test('a generated town exposes court docks and the complete curved rail alignment to routing', () => {
	const { world } = openingScene(7);
	const graph = cityMovementNetwork(world, 120);
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	for (const edge of graph.edges) {
		expect(ports.has(edge.from) && ports.has(edge.to)).toBe(true);
		expect(Number.isFinite(edge.grade) && Number.isFinite(edge.length)).toBe(true);
	}
	expect(graph.edges.some((e) => ports.get(e.from)?.kind === 'court' && e.kind === 'dock')).toBe(
		true
	);
	for (const line of world.lines) {
		const rides = graph.edges.filter(
			(e) => e.mode === 'rail' && e.id.startsWith('transit/' + line.id + '/')
		);
		expect(rides).toHaveLength(line.stops.length - 1);
		expect(rides.reduce((total, e) => total + e.length, 0)).toBeCloseTo(line.length, 5);
	}
});

type Town = ReturnType<typeof townSections>['sections'];
type Graph = ReturnType<typeof cityMovementNetwork>;
// One open lookout above free ground under a tensioned cloth, stated in role slots only.
function isTentMast({ composition: { structure } }: Town[number]) {
	const [lookout] = structure.platforms;
	const cloth = structure.skins.every((skin) => skin.slot === 'shell' && skin.membrane);
	const free = lookout.datum > structure.ground + 2.2 && !lookout.room;
	return structure.principle === 'mast' && structure.platforms.length === 1 && free && cloth;
}
function reachedKinds(graph: Graph, start: string) {
	const reached = new Set([start]);
	for (const id of reached)
		for (const e of graph.edges.filter((e) => e.from === id || e.to === id))
			reached.add(e.from).add(e.to);
	return graph.ports.filter((p) => reached.has(p.id)).map((p) => p.kind);
}

test('a free-standing tent mast in the opening town is entered from its court', () => {
	const { world } = openingScene(7);
	const graph = cityMovementNetwork(world, 120);
	const groups = new Map(composedProjection(world).map((g) => [g.id, g]));
	const courts = world.state.city?.centres.flatMap((c) => c.ensembles ?? []) ?? [];
	const tents = townSections(world).sections.filter(isTentMast);
	expect(tents.length).toBeGreaterThan(0);
	for (const tent of tents) {
		const door = groups.get(tent.id)?.door;
		if (!door) throw new Error('Tent mast ' + tent.id + ' stands on no court');
		// Its lot belongs to the court it opens to, and that court leads on to the town walk.
		expect(courts.find((e) => e.court === door.court)?.lots).toContain(tent.cells[0].id);
		const kinds = reachedKinds(graph, door.port.id);
		expect(kinds).toContain('court');
		expect(kinds).toContain('walkway');
	}
});

test('layered houses keep their layers beside the free-standing ones', () => {
	const { sections } = townSections(openingScene(7).world);
	const layered = sections.filter((s) => s.composition.structure.principle === 'layers');
	expect(layered.length).toBeGreaterThan(0);
	for (const { composition } of layered)
		expect(composition.structure.platforms.some((p) => p.room)).toBe(true);
});

test('the seed 7 public ribbon crosses a framed house between its surveyed entrance ports', () => {
	const { world } = openingScene(7);
	const graph = cityMovementNetwork(world, 120);
	const houses = new Map(composedProjection(world).map((h) => [h.id, h]));
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const tunnels = graph.edges.filter((e) => e.kind === 'tunnel');
	expect(tunnels.length).toBeGreaterThan(0);
	for (const edge of tunnels) {
		const a = required(ports.get(edge.from), 'entry sill'),
			b = required(ports.get(edge.to), 'exit sill');
		const house = required(houses.get(a.id.split('/portal/')[0]), 'passage house');
		const passage = required(house.passage, 'house passage survey');
		expect(new Set([passage.entry.port?.id, passage.exit.port?.id])).toEqual(new Set([a.id, b.id]));
		const parts = house.parts();
		expect(parts.some((p) => p.id.includes('/portal/frame/'))).toBe(true);
		const lane = deckCorners([...a.position], [...b.position], edge.width).map(([x, y]): Point2 => [
			x,
			y
		]);
		for (const part of parts) {
			if (
				part.kind !== 'prism' ||
				part.z >= a.position[2] + a.headroom - 1e-7 ||
				part.z + part.height <= a.position[2] + 1e-7
			)
				continue;
			expect(area(intersect(part.polygon, lane)), part.id).toBeLessThan(1e-7);
		}
		expect([a.kind, b.kind]).toEqual(['entrance', 'entrance']);
		expect(Math.min(a.width, b.width)).toBeGreaterThanOrEqual(2.5);
		expect(Math.min(a.headroom, b.headroom)).toBeGreaterThanOrEqual(2.2);
		expect(Math.cos(a.heading - b.heading)).toBeCloseTo(-1, 8);
		expect(reachedKinds(graph, a.id)).toContain('court');
		for (const end of [a, b])
			expect(
				graph.edges.some((e) => e.kind === 'path' && (e.from === end.id || e.to === end.id))
			).toBe(true);
	}
});

test('the seed 7 house exit descends on paired piers to a paved ground dock', () => {
	const { world } = acceptanceScene(7);
	const { plan, ground } = required(cityCorridorPlan(world), 'town survey');
	const tunnel = required(
		plan.graph.edges.find((e) => e.kind === 'tunnel' && e.from.startsWith('29/29/portal/')),
		'house crossing'
	);
	const exit = required(
		plan.graph.edges.find((e) => e.from === tunnel.to && e.kind === 'path'),
		'exit ramp'
	);
	const dock = required(
		plan.graph.edges.find((e) => e.from === exit.to && e.kind === 'dock'),
		'ground dock'
	);
	const foot = required(
		plan.graph.ports.find((p) => p.id === dock.to),
		'landing'
	);
	const landing = required(foot.groundLanding, 'paved landing');
	expect(landing.depth).toBeGreaterThanOrEqual(2.5);
	for (const [x, y, z] of landing.toe) expect(z).toBeCloseTo(ground(x, y), 7);
	const parts = cityCentreView(world);
	expect(parts.find((p) => p.id === foot.id + '/foot')).toMatchObject({ kind: 'prism' });
	for (const side of [0, 1]) {
		const piers = parts.filter((p) => p.id.startsWith(exit.id + '/pier/' + side + '/'));
		expect(piers.length).toBeGreaterThan(0);
		for (const p of piers) {
			if (p.kind !== 'cylinder') throw Error('Missing bearing');
			expect(p.position[2]).toBeCloseTo(ground(p.position[0], p.position[1]), 7);
		}
	}
	const house = required(
		composedProjection(world).find((h) => h.id === '29/29'),
		'portal frame'
	);
	const surrounds = house.parts().filter((p) => p.id.includes('/portal/frame/surround/'));
	expect(new Set(surrounds.map((p) => p.id.split('/surround/')[1].split('/')[0])).size).toBe(2);
});

test('seed 7 queries ground path, level-change ramp and upper bridge in one connected graph', () => {
	const graph = cityMovementNetwork(openingScene(7).world, 120);
	const stepFree = { modes: ['walk'] as const, maxGrade: 0.08, excludeKinds: ['stair'] as const };
	const groundPath = required(
		findMovementPath(graph, '29/29/portal/b', '30/29', stepFree),
		'ground path'
	);
	expect(groundPath.edgeIds).toEqual(['town-walk/passage/29/29/approach/1']);
	expect(groundPath.maxGrade).toBeLessThanOrEqual(0.08 + 1e-9);
	const levelChange = required(
		findMovementPath(graph, 'town-walk/passage/29/29/ground', '29/29/portal/a', stepFree),
		'exit ramp'
	);
	expect(levelChange.edgeIds).toEqual([
		'town-walk/passage/29/29/ground/dock',
		'town-walk/passage/29/29/descent/0'
	]);
	const last = required(levelChange.points.at(-1), 'ramp top');
	expect(levelChange.points[0][2]).toBeLessThan(last[2]);
	const upperRoute = required(
		findMovementPath(graph, 'town-walk/passage/29/29/ground', '36/35>36/34', stepFree),
		'ground-to-bridge route'
	);
	expect(upperRoute.edgeIds).toEqual([
		'town-walk/passage/29/29/ground/dock',
		'town-walk/passage/29/29/descent/0',
		'town-walk/passage/29/29/inside/0',
		'town-walk/passage/29/29/approach/1',
		'30/29/dock',
		'town-walk/30/29>34/27',
		'35/30>35/29/landing',
		'35/30>36/30/landing',
		'town-walk/36/35>36/34'
	]);
	expect(upperRoute.minHeadroom).toBeGreaterThanOrEqual(2.2);
	expect(
		findMovementPath(graph, 'town-walk/passage/29/29/ground', '36/35>36/34', {
			modes: ['walk'],
			maxGrade: 0.05
		})
	).toBeUndefined();
	expect(
		findMovementPath(graph, '30/29', '30/30/threshold', { modes: ['walk'], maxGrade: 0.08 })
	).toBeUndefined();
	expect(
		findMovementPath(graph, '30/29', '30/30/threshold', { modes: ['walk'] })?.edgeIds
	).toContain('30/30/threshold/crossing');
});
