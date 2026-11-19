import { survey } from './clearance';
import { deckOptions } from './deck-route';
import { project } from './geometry';
import { shapeForks } from './forks';
import { layout } from './graph';
import { groundTree, entranceTree } from './ground-tree';
import { epsilon, type NetworkInput, type Network } from './types';

export type { NetworkInput, Network };

function validate(input: NetworkInput, seed: number) {
	if (
		!Number.isSafeInteger(seed) ||
		!Number.isFinite(input.ensembleArea) ||
		input.ensembleArea <= 0
	)
		throw new RangeError('Expected an integer seed and positive ensemble area');
	if (
		input.houses.length < 2 ||
		new Set(input.houses.map((h) => h.id)).size !== input.houses.length
	)
		throw new RangeError('Expected multiple houses with unique identifiers');
	const datum = input.datum ?? 0;
	if (!Number.isFinite(datum)) throw new RangeError('Invalid ensemble datum');
	for (const h of input.houses) {
		if (!h.entrance.every(Number.isFinite)) throw new RangeError('Invalid entrance');
		for (const p of h.ports ?? []) {
			const level = (p[2] - datum) / 2;
			if (!p.every(Number.isFinite) || Math.abs(level - Math.round(level)) > epsilon)
				throw new RangeError('Invalid port on the ensemble datum');
		}
	}
}
function met(network: Omit<Network, 'geometry'>, area: number) {
	return (
		network.length <= 1.6 * network.entranceMst + epsilon &&
		network.planArea <= 0.12 * area + epsilon
	);
}
/**
 * Plans a detached public tree in world metres (x/y plan, z up) for distinct external
 * ground entrances. Stable house IDs order branch attachment. The integer seed breaks
 * equal-cost corner ties. Obstacles and convex blocked cells include the half deck width.
 * Supply the actual ensemble area, a pure finite height sampler and optional ports on
 * the common 2 m datum (sole defaults to zero). Ground polylines sample at most 1 m apart.
 * Optional neighbouring ports compete for the remaining length and footprint budgets.
 * Throws RangeError for invalid input, unreachable entrances or an infeasible mandatory
 * tree. Inputs are read only. Geometry carries material slots for the caller to dress.
 */
export function planNetwork(input: NetworkInput, seed: number): Network {
	validate(input, seed);
	const checked = {
		...input,
		terrain: (x: number, y: number) => {
			const z = input.terrain(x, y);
			if (!Number.isFinite(z)) throw new RangeError('Invalid sampled terrain height');
			return z;
		}
	};
	const field = survey(checked);
	if (input.houses.some((h) => !field.clear(h.entrance, h.entrance)))
		throw new RangeError('Entrance lacks clearance');
	const houses = [...input.houses].sort((a, b) => (a.id < b.id ? -1 : 1));
	const { total: reference, order } = entranceTree(houses.map((h) => h.entrance));
	const grow = (ordered: NetworkInput['houses']) => {
		const tree = groundTree(ordered, seed, field);
		shapeForks(tree, checked, field);
		return { tree, network: layout(checked, tree, reference) };
	};
	let { tree, network } = grow(houses);
	if (!met(network, input.ensembleArea)) {
		({ tree, network } = grow(order.map((i) => houses[i])));
		if (!met(network, input.ensembleArea))
			throw new RangeError('Mandatory network exceeds ensemble budget');
	}
	for (const option of deckOptions(checked, tree, field)) {
		const candidate = layout(checked, tree, reference, option);
		if (met(candidate, input.ensembleArea)) {
			network = candidate;
			break;
		}
	}
	return { ...network, geometry: project(network, checked, seed) };
}
