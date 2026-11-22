import { createHash } from 'node:crypto';
import { expect, test } from 'bun:test';
import { buildObject } from './index';
import frozen from './fixtures/ribbon-seed7-fingerprint.json';
import { connectionSection, connectionViews } from '../connection-study';
import {
	edgePath,
	movementNetwork,
	pedestrianHeadroom,
	walkingCapacity
} from '../movement-network';
import { openingScene } from '../sandbox';
import { cityCorridorPaths, cityCorridorPlan } from '../sandbox/city-corridors';
import { cityCentreView } from '../sandbox/city-view';
import { edgeSections } from '../walkway-network/edge-sections';

function sha256(value: unknown) {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

test('seed-7 sandbox ribbon callers match the frozen R1.2 fingerprint', () => {
	const world = openingScene(frozen.seed).world;
	const corridors = cityCorridorPaths(world);
	const centre = cityCentreView(world);
	const plan = cityCorridorPlan(world);
	expect(plan).toBeDefined();
	if (!plan) return;

	const { graph } = plan.plan;
	expect(graph.edges).toHaveLength(frozen.sandbox.graphEdges);
	expect(graph.ports).toHaveLength(frozen.sandbox.graphPorts);

	expect(corridors).toHaveLength(frozen.sandbox.cityCorridorPaths.count);
	expect(sha256(corridors)).toBe(frozen.sandbox.cityCorridorPaths.sha256);

	expect(centre).toHaveLength(frozen.sandbox.cityCentreView.count);
	expect(sha256(centre)).toBe(frozen.sandbox.cityCentreView.sha256);

	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const landings = new Set(
		graph.edges
			.filter((e) => e.kind === 'dock' && ports.get(e.to)?.groundLanding)
			.map((e) => e.from)
	);
	const segments = [];
	for (const e of graph.edges) {
		if (
			e.mode !== 'walk' ||
			e.kind === 'dock' ||
			e.kind === 'junction' ||
			e.kind === 'court' ||
			e.kind === 'stair'
		)
			continue;
		const sections = edgeSections(e, edgePath(e, ports));
		const variant = e.kind === 'tunnel' ? 'tunnel' : landings.has(e.to) ? 'paired' : 'supported';
		const built = buildObject('ribbon-segment', variant, 0, {
			instanceId: e.id,
			site: {
				sections,
				ground: plan.ground,
				ports: { start: ports.get(e.from), end: ports.get(e.to) }
			}
		});
		segments.push({
			id: e.id,
			variant,
			partCount: built.parts.length,
			footprint: built.footprint,
			anchors: built.anchors,
			partsSha256: sha256(built.parts)
		});
	}

	expect(JSON.parse(JSON.stringify(segments))).toEqual(frozen.sandbox.ribbonSegments);
});

test('bible connection-study ribbon callers match the frozen R1.2 fingerprint', () => {
	expect(connectionSection).toHaveLength(frozen.bible.connectionSection.count);
	expect(sha256(connectionSection)).toBe(frozen.bible.connectionSection.sha256);

	expect(connectionViews).toHaveLength(frozen.bible.connectionViews.count);
	expect(sha256(connectionViews)).toBe(frozen.bible.connectionViews.sha256);

	const walking = connectionViews.flatMap(({ walkingKind, ...c }) =>
		walkingKind ? [{ ...c, kind: walkingKind }] : []
	);
	const width = 1.8;
	const graph = movementNetwork(
		walking.flatMap(({ id, kind, points }) => [
			{
				id: id + '/network',
				kind,
				position: points[0],
				heading: 0,
				width,
				headroom: pedestrianHeadroom,
				accepts: ['entrance']
			},
			{
				id: id + '/door',
				kind: 'entrance',
				position: points[points.length - 1],
				heading: -Math.PI / 2,
				width,
				headroom: pedestrianHeadroom,
				accepts: ['bridge', 'path']
			}
		]),
		walking.map(({ id, kind, points }) => ({
			id,
			from: id + '/network',
			to: id + '/door',
			kind,
			mode: 'walk',
			capacity: walkingCapacity(width),
			via: points.slice(1, -1)
		})),
		[]
	);
	const ports = new Map(graph.ports.map((p) => [p.id, p]));
	const paperSurface = { role: 'bestand', material: 'paper' } as const;
	const segments = graph.edges.map((e) => {
		const sections = edgeSections(e, edgePath(e, ports));
		const built = buildObject('ribbon-segment', 'supported', 0, {
			instanceId: e.id,
			slots: { walking: paperSurface, bearing: paperSurface },
			site: {
				sections,
				ground: () => 0,
				ports: { start: ports.get(e.from), end: ports.get(e.to) }
			}
		});
		return {
			id: e.id,
			variant: 'supported',
			partCount: built.parts.length,
			footprint: built.footprint,
			anchors: built.anchors,
			partsSha256: sha256(built.parts)
		};
	});

	expect(JSON.parse(JSON.stringify(segments))).toEqual(frozen.bible.ribbonSegments);
});
