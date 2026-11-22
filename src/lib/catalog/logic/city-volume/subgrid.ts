import type { GroundPlan } from '../city-plan';
import { required } from '../required';
import type { Column, Vertex } from './envelope';

export function edgeId(a: Vertex, b: Vertex) {
	return a.id < b.id ? a.id + '+' + b.id : b.id + '+' + a.id;
}

function edges(ring: Vertex[]) {
	return ring.map((a, i) => edgeId(a, ring[(i + 1) % ring.length]));
}

function contactingColumns(columns: Column[], [a, b]: readonly [string, string]) {
	const left = columns.filter((c) => c.groundId === a);
	const right = columns.filter((c) => c.groundId === b);
	for (const first of left) {
		const sideIds = new Set(edges(first.ring));
		const second = right.find((column) => edges(column.ring).some((id) => sideIds.has(id)));
		if (a !== b && second) return [first, second];
	}
	throw new RangeError('Refinement requires two side-adjacent ground cells');
}

function meanVertex(id: string, ring: Vertex[]): Vertex {
	const mean = (key: keyof Omit<Vertex, 'id'>) =>
		ring.reduce((sum, v) => sum + v[key], 0) / ring.length;
	return { id, x: mean('x'), y: mean('y'), ground: mean('ground'), canopy: mean('canopy') };
}

export function localSubgrids(
	plan: GroundPlan,
	columns: Column[],
	pair?: readonly [string, string]
) {
	const anchor = required(
		plan.cells.find((c) => c.id === plan.anchorId),
		'plan anchor'
	);
	const groundPair = pair ?? [
		anchor.id,
		required(anchor.neighbors.filter((id) => id !== null).sort()[0], 'anchor neighbour')
	];
	const selected = contactingColumns(columns, groundPair);
	const midpoints = new Map<string, Vertex>();
	const tiles = new Map<string, { slot: string; ring: Vertex[] }[]>();
	const halfEdges = new Set<string>();
	const halfVertices = new Set<string>();
	for (const { id, ring } of selected) {
		const center = meanVertex('center:' + id, ring);
		const mids = ring.map((a, i) => {
			const b = ring[(i + 1) % ring.length];
			const key = edgeId(a, b);
			const mid = midpoints.get(key) ?? meanVertex('mid:' + key, [a, b]);
			midpoints.set(key, mid);
			return mid;
		});
		tiles.set(
			id,
			ring.map((v, i) => {
				const tile = [v, mids[i], center, mids[(i + ring.length - 1) % ring.length]];
				for (const side of edges(tile)) halfEdges.add(side);
				for (const point of tile) halfVertices.add(point.id);
				return { slot: v.id, ring: tile };
			})
		);
	}
	return { midpoints, tiles, halfEdges, halfVertices };
}

export type Subgrids = ReturnType<typeof localSubgrids>;
