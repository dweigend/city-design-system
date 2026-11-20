import { test, expect } from 'bun:test';
import { cityMovementNetwork, composedProjection, openingScene } from './index';
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
