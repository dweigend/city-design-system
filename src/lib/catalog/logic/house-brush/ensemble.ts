import {
	ensembleRole,
	ensembleSetback,
	type EnsembleDistrict,
	type EnsembleRole,
	type StoreySurcharge
} from '../district-frame';
import { neighborsOf, type QuadCell, type QuadGrid } from '../quad-grid';
import { ensembleHeights, surchargeOf, type HeightSite } from './ensemble-heights';
import { storiesOf, type Stacks } from './stacks';

type Placement = Readonly<{
	placed: number;
	front: number;
	district: EnsembleDistrict;
	layer?: string;
}>;

export type EnsembleCell = Readonly<{
	id: string;
	body: string;
	role: EnsembleRole;
	height: number;
	surcharge: StoreySurcharge;
	neighbors: readonly string[];
	front: number;
	setback: number;
}>;

export type Ensembles = Readonly<{
	cells: ReadonlyMap<string, EnsembleCell>;
	members: ReadonlyMap<string, readonly string[]>;
}>;

function adjacent(grid: QuadGrid, placements: ReadonlyMap<string, Placement>, cell: QuadCell) {
	const direct = neighborsOf(grid, cell);
	const across = direct.flatMap((next) => (placements.has(next.id) ? [] : neighborsOf(grid, next)));
	return [...new Set([...direct, ...across].map(({ id }) => id))]
		.filter((id) => id !== cell.id && placements.has(id))
		.sort();
}

function heightSites(
	grid: QuadGrid,
	walls: QuadGrid,
	stacks: Stacks,
	placements: ReadonlyMap<string, Placement>
) {
	const sites = new Map<string, HeightSite>();
	for (const id of [...placements.keys()].sort()) {
		const cell = grid.cellsById.get(id);
		if (!cell) continue;
		const height = storiesOf(stacks, id).length;
		const plot = walls.cellsById.get(id);
		const joins = plot
			? neighborsOf(walls, plot).filter(
					(other) =>
						other.pad === cell.pad &&
						other.raised === cell.raised &&
						placements.get(other.id)?.layer === placements.get(id)?.layer
				)
			: [];
		sites.set(id, {
			cell,
			height,
			neighbors: adjacent(grid, placements, cell),
			joins: joins.map((other) => other.id)
		});
	}
	return sites;
}

function components(sites: ReadonlyMap<string, HeightSite>) {
	const seen = new Set<string>();
	const groups: HeightSite[][] = [];
	for (const [id, first] of sites) {
		if (seen.has(id)) continue;
		seen.add(id);
		const group = [first];
		for (const { neighbors } of group)
			for (const next of neighbors) {
				const site = sites.get(next);
				if (!site || seen.has(next)) continue;
				seen.add(next);
				group.push(site);
			}
		groups.push(group.sort((a, b) => (a.cell.id < b.cell.id ? -1 : 1)));
	}
	return groups;
}

function joinedBody(site: HeightSite, remaining: Map<string, HeightSite>) {
	const group = [site];
	remaining.delete(site.cell.id);
	for (const member of group)
		for (const id of member.joins) {
			const other = remaining.get(id);
			if (!other) continue;
			remaining.delete(id);
			group.push(other);
		}
	return group;
}

function rolesOf(
	group: readonly HeightSite[],
	heights: ReadonlyMap<string, number>,
	peak: string | undefined,
	placements: ReadonlyMap<string, Placement>,
	seed: number
) {
	const roles = new Map<string, { role: EnsembleRole; body: string }>();
	const remaining = new Map(
		group
			.filter((site) => site.cell.id !== peak)
			.map((site) => [
				site.cell.id,
				{ ...site, joins: site.joins.filter((id) => heights.get(id) === heights.get(site.cell.id)) }
			])
	);
	for (const site of group) {
		const id = site.cell.id;
		const first = remaining.get(id);
		if (!first) continue;
		const body = {
			role: ensembleRole(seed, id, placements.get(id)?.district ?? 'infill'),
			body: id
		};
		for (const member of joinedBody(first, remaining)) roles.set(member.cell.id, body);
	}
	return roles;
}

function groupCells(
	group: readonly HeightSite[],
	placements: ReadonlyMap<string, Placement>,
	seed: number
) {
	const id = group[0].cell.id;
	const { peak, heights } = ensembleHeights(group, seed);
	const merged = rolesOf(group, heights, peak, placements, seed);
	return group.map((site): [string, EnsembleCell] => {
		const key = site.cell.id;
		const placement = placements.get(key);
		const later =
			placement &&
			site.neighbors.some((n) => (placements.get(n)?.placed ?? Infinity) < placement.placed);
		const body = merged.get(key) ?? { body: key, role: 'turm' };
		return [
			key,
			{
				id,
				...body,
				height: heights.get(key) ?? site.height,
				surcharge: surchargeOf(site, heights),
				neighbors: site.neighbors,
				front: placement?.front ?? 0,
				setback: later ? ensembleSetback(seed, key) : 0
			}
		];
	});
}

const signatures = new WeakMap<Ensembles, Map<string, string>>();

function signature(
	group: readonly HeightSite[],
	placements: ReadonlyMap<string, Placement>,
	seed: number
) {
	return JSON.stringify([
		seed,
		group.map(({ cell, height, neighbors, joins }) => [
			cell.id,
			cell.center,
			height,
			neighbors,
			joins,
			placements.get(cell.id)
		])
	]);
}

/**
 * Plans painted cells in lexical components of the carrier graph. A shared edge or a single
 * intervening parcel joins a component. The plot graph separately identifies shared walls.
 * Placement order, use-independent heights and detachment from other components are preserved.
 */
export function planEnsembles(
	grid: QuadGrid,
	walls: QuadGrid,
	stacks: Stacks,
	placements: ReadonlyMap<string, Placement>,
	seed: number,
	previous?: Ensembles
): Ensembles {
	const cells = new Map<string, EnsembleCell>();
	const members = new Map<string, readonly string[]>();
	const nextSignatures = new Map<string, string>();
	for (const group of components(heightSites(grid, walls, stacks, placements))) {
		const id = group[0].cell.id;
		const ids = group.map(({ cell }) => cell.id);
		members.set(id, ids);
		const key = signature(group, placements, seed);
		nextSignatures.set(id, key);
		if (previous && signatures.get(previous)?.get(id) === key) {
			for (const cell of ids) {
				const old = previous.cells.get(cell);
				if (old) cells.set(cell, old);
			}
		} else
			for (const [cell, record] of groupCells(group, placements, seed)) cells.set(cell, record);
	}
	const layout = { cells, members };
	signatures.set(layout, nextSignatures);
	return layout;
}
