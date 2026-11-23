import { required } from '../../core/invariant';
import { bayAddresses } from './bay-addresses';
import { columnPlanes } from './foundation';
import { hasCollapsedDiagonal } from './foundation-prism';
import type { CityLattice, Column } from './frame';
import { readPlanTopology } from './plan-topology';
import { addLayer, type Add, type SharedMedial } from './plane-cells';
import {
	jointsOf,
	type ColumnBands,
	type Joint,
	type PlaneKind,
	type PlaneRule
} from './plane-joints';
import { cleanFaces, closeSolid, type LatticeSolid } from './solid';

/** Builds a lattice whose level planes follow the rule. Bays and their side faces are the shared
 * address frame of the box lattice; solids and members come from the rule. A member is a solid
 * edge: a chord joins two joints of one plane, a strut joins two planes. */
export function createPlaneLattice(
	columns: readonly Column[],
	datumZ: number,
	rule: PlaneRule
): CityLattice {
	const triangulated = new Set<string>();
	const addresses = bayAddresses(columns, datumZ, ({ id, bottom, top }, first) => {
		if (first && hasCollapsedDiagonal(bottom, top))
			triangulated.add(id.slice(0, id.lastIndexOf('/level/')));
	});
	const topology = readPlanTopology(columns);
	const byColumn = new Map(
		columns.map((column) => [column.planCellId, columnPlanes(column, datumZ)])
	);
	const bands: ColumnBands = (id) => required(byColumn.get(id), 'column planes');
	const joints = jointsOf(topology, datumZ);
	const kind = (id: string, level: number) => {
		const { foundation: base } = bands(id);
		return level < base ? 'plan' : rule.plane(level, level - base);
	};
	const occupied = (id: string, level: number) => {
		const { first, roof } = bands(id);
		return first <= level && level < roof;
	};
	const pair = (id: string, level: number): readonly [PlaneKind, PlaneKind] => {
		const { foundation: base } = bands(id);
		return level < base ? ['plan', 'plan'] : [kind(id, level), kind(id, level + 1)];
	};
	const carriesFoot = (id: string, level: number) =>
		level + 1 === bands(id).foundation && occupied(id, level + 1) && kind(id, level + 1) === 'foot';
	const sharedMedial: SharedMedial = (id, key, level) => {
		const other = topology.edges.get(key)?.cells.find((cell) => cell !== id);
		if (other === undefined || !occupied(other, level)) return;
		const [low, high] = pair(other, level);
		if (low === 'medial' && high === 'plan') return level;
		if (low === 'plan' && high === 'medial') return level + 1;
	};
	const splitAtMidpoint = (loop: readonly Joint[]) =>
		loop.flatMap((a, i) => {
			const b = loop[(i + 1) % loop.length];
			if (!a.corner || !b.corner || a.id === b.id || a.position[2] !== b.position[2]) return [a];
			const level = a.level;
			if (level !== b.level || level === 0) return [a];
			const key = topology.edgeKey(a.corner, b.corner);
			const edge = topology.edges.get(key);
			if (
				!edge?.cells.some((id) => {
					const { foundation: base, roof } = bands(id);
					return base <= level && level <= roof && kind(id, level) === 'medial';
				})
			)
				return [a];
			return [a, joints.middle(key, level)];
		});
	const solids: LatticeSolid[] = [];
	const edges = new Map<string, CityLattice['edges'][number]>();
	const used = new Map<string, CityLattice['nodes'][number]>();
	const add: Add = (id, bay, raw) => {
		const loops = cleanFaces(raw.map(splitAtMidpoint));
		solids.push(closeSolid(id, bay, loops));
		for (const loop of loops) {
			for (const [i, a] of loop.entries()) {
				const b = loop[(i + 1) % loop.length];
				if (!used.has(a.id)) used.set(a.id, Object.freeze({ id: a.id, position: a.position }));
				const [from, to] = a.id < b.id ? [a, b] : [b, a];
				const key = `${from.id}\n${to.id}`;
				if (edges.has(key)) continue;
				const id = JSON.stringify([from.id, to.id]);
				const rank = a.level === b.level ? 'chord' : 'strut';
				edges.set(key, Object.freeze({ id, from: from.id, to: to.id, rank }));
			}
		}
	};
	const layers = new Map<
		number,
		Map<string, { low: PlaneKind; high: PlaneKind; cells: Set<string> }>
	>();
	for (const [id, { first, roof }] of byColumn) {
		for (let level = first; level < roof; level++) {
			let groups = layers.get(level);
			if (!groups) layers.set(level, (groups = new Map()));
			const [low, high] = pair(id, level);
			const key = `${low}/${high}`;
			let group = groups.get(key);
			if (!group) groups.set(key, (group = { low, high, cells: new Set() }));
			group.cells.add(id);
		}
	}
	for (const level of [...layers.keys()].sort((a, b) => a - b)) {
		const groups = required(layers.get(level), 'occupied layer');
		for (const { low, high, cells } of groups.values())
			addLayer(
				topology,
				joints,
				{ level, low, high, cells },
				add,
				carriesFoot,
				sharedMedial,
				triangulated
			);
	}
	return Object.freeze({
		...addresses,
		nodes: Object.freeze([...used.values()]),
		edges: Object.freeze([...edges.values()]),
		solids: Object.freeze(solids)
	});
}
