import { expect, test } from 'bun:test';
import type { ParcelLane, ParcelPortal } from '../../domain/parcels';
import { createMovementNetwork, type MovementNode } from '../../domain/movement-network';
import { required } from '../../core/invariant';
import { createWorldReference, readWorldReference } from '../../core/ref';
import { createCitySite } from '../city-site';
import { connectLane } from './lane-links';

test('a 10 nm frontage move updates lane geometry without renaming the tap or adjacent links', () => {
	const site = createCitySite(() => ({ height: 0, waterClearance: 20, waterKind: null }));
	const from: MovementNode = { id: 'a|b', position: [0, 0, 0], level: 'ground' };
	const to: MovementNode = { id: 'z', position: [100, 0, 0], level: 'ground' };
	const lane: ParcelLane = {
		id: 'existing/lane',
		edgeId: 'edge',
		nodeIds: [from.id, to.id],
		provenance: { kind: 'plan', planEdgeId: 'edge', t0: 0, t1: 1, forward: true },
		points: [
			[0, 0],
			[100, 0]
		],
		lengthM: 100,
		widthM: 4,
		hierarchy: ['main'],
		surface: 'walk',
		blockIds: ['holding']
	};
	const portal: ParcelPortal = {
		id: 'frontage|a/\nb',
		parcelId: 'holding',
		side: ['a', 'b'],
		laneId: lane.id,
		points: [
			[40, 2],
			[60, 2]
		],
		frontageM: 20
	};
	function read(portal: ParcelPortal) {
		const nodes = new Map<string, MovementNode>();
		const links = connectLane(site, lane, from, to, [portal], nodes, new Map(), () => true);
		return { links, nodes: [...nodes.values()] };
	}
	const before = read(portal);
	const delta = 1e-8;
	const after = read({
		...portal,
		points: [
			[40 + delta, 2],
			[60 + delta, 2]
		]
	});
	expect(after.nodes.map(({ id }) => id)).toEqual(before.nodes.map(({ id }) => id));
	expect(after.nodes.map(({ position }) => position)).not.toEqual(
		before.nodes.map(({ position }) => position)
	);
	const adjacent = before.links.filter(({ lane }) => lane);
	expect(adjacent).toHaveLength(2);
	const saved = adjacent.map(({ id }) =>
		JSON.stringify(createWorldReference('lane-fixture', 'graph-edge', id))
	);
	const moved = createMovementNetwork([from, to, ...after.nodes], after.links);
	const route = moved.readRoute(from.id, to.id);
	expect(route?.edges.map(({ id }) => id)).toEqual(
		saved.map((json) => required(readWorldReference(JSON.parse(json)), 'saved edge').key)
	);
	expect(after.links.map(({ id }) => id)).toEqual(before.links.map(({ id }) => id));
});
