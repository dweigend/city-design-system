import { laneSettings as settings } from '../../../config/lanes';
import { required } from '../../core/invariant';
import { planEdgeGraph, type DryPlanEdge, type TerrainGrid } from '../../domain/terrain-grid';
import type { CityTerrainSampler } from './sampling';

/** Connects ends of neighboring shore chains on dry edges close to the bank. A gap can stay open. */
export function shoreDetours(
	grid: TerrainGrid,
	edges: readonly DryPlanEdge[],
	sample: CityTerrainSampler
) {
	const byId = new Map(edges.map((edge) => [edge.id, edge]));
	const graph = planEdgeGraph(grid, ({ id }) => byId.has(id));
	const bank = new Map<string, string[]>();
	for (const {
		bank: isBank,
		nodeIds: [a, b]
	} of edges) {
		if (!isBank) continue;
		bank.set(a, [...(bank.get(a) ?? []), b]);
		bank.set(b, [...(bank.get(b) ?? []), a]);
	}
	const component = new Map<string, string>();
	for (const start of [...bank.keys()].sort()) {
		if (component.has(start)) continue;
		const queue = [start];
		component.set(start, start);
		for (const node of queue) {
			for (const next of bank.get(node) ?? []) {
				if (component.has(next)) continue;
				component.set(next, start);
				queue.push(next);
			}
		}
	}
	const ends = [...bank.keys()].filter((id) => bank.get(id)?.length === 1).sort();
	const available = new Set(ends);
	const shortcuts = new Set<string>();
	const parent = new Map<string, string>();
	function root(id: string): string {
		const next = parent.get(id);
		return next === undefined ? id : root(next);
	}
	const reach = new Map<string, boolean>();
	for (const start of ends) {
		if (!available.delete(start)) continue;
		const own = root(required(component.get(start), 'shore component'));
		const search = graph
			.pathsFrom(
				start,
				(id) =>
					available.has(id) && root(required(component.get(id), 'nearby shore component')) !== own,
				settings.promenadeDetourM,
				({ id, nodeIds: [a, b], lengthM }) => {
					let near = reach.get(id);
					if (near === undefined) {
						const [x, y] = graph.point(a);
						const [u, v] = graph.point(b);
						near = sample((x + u) / 2, (y + v) / 2).waterClearance <= settings.promenadeReachM;
						reach.set(id, near);
					}
					return near ? lengthM : Infinity;
				}
			)
			.next();
		if (search.done) continue;
		const other = required(search.value.nodeIds.at(-1), 'shore detour end');
		parent.set(root(required(component.get(other), 'other shoreline')), own);
		available.delete(other);
		for (const { id } of search.value.edges) shortcuts.add(id);
	}
	return shortcuts;
}
