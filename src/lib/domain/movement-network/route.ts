import type { MovementEdge, MovementRoute } from './types';

type Visit<K extends string> = Readonly<{
	id: string;
	cost: number;
	previous?: Visit<K>;
	edge?: MovementEdge<K>;
}>;

function before<K extends string>(a: Visit<K>, b: Visit<K>) {
	return a.cost < b.cost || (a.cost === b.cost && a.id < b.id);
}

// Exact arithmetic: a binary heap stores each parent's children at 2i + 1 and 2i + 2.
function queue<K extends string>() {
	const items: Visit<K>[] = [];
	return {
		add(visit: Visit<K>) {
			let index = items.length;
			while (index > 0) {
				const parent = Math.floor((index - 1) / 2);
				if (!before(visit, items[parent])) break;
				items[index] = items[parent];
				index = parent;
			}
			items[index] = visit;
		},
		take() {
			const first = items[0];
			const last = items.pop();
			if (!last || !items.length) return first;
			let index = 0;
			while (2 * index + 1 < items.length) {
				const left = 2 * index + 1;
				const right = left + 1;
				const child = right < items.length && before(items[right], items[left]) ? right : left;
				if (!before(items[child], last)) break;
				items[index] = items[child];
				index = child;
			}
			items[index] = last;
			return first;
		}
	};
}

function routeTo<K extends string>(end: Visit<K>): MovementRoute<K> {
	const nodes = [end.id];
	const edges: MovementEdge<K>[] = [];
	let lengthM = 0;
	let climbM = 0;
	for (let step = end; step.previous && step.edge; step = step.previous) {
		const { points, nodeIds } = step.edge;
		const direction = nodeIds[1] === step.id ? 1 : -1;
		for (let i = 1; i < points.length; i++)
			climbM += Math.max(0, direction * (points[i][2] - points[i - 1][2]));
		lengthM += step.edge.lengthM;
		nodes.push(step.previous.id);
		edges.push(step.edge);
	}
	return Object.freeze({
		nodes: Object.freeze(nodes.reverse()),
		edges: Object.freeze(edges.reverse()),
		climbM,
		lengthM,
		cost: end.cost
	});
}

// Exact arithmetic: the origin has zero accumulated cost.
export function shortest<K extends string>(
	adjacent: ReadonlyMap<string, readonly MovementEdge<K>[]>,
	from: string,
	to: string
) {
	const origin = { id: from, cost: 0 };
	const best = new Map<string, Visit<K>>([[from, origin]]);
	const pending = queue<K>();
	pending.add(origin);
	for (let visit = pending.take(); visit; visit = pending.take()) {
		if (best.get(visit.id) !== visit) continue;
		if (visit.id === to) return routeTo(visit);
		for (const edge of adjacent.get(visit.id) ?? []) {
			const id = edge.nodeIds[0] === visit.id ? edge.nodeIds[1] : edge.nodeIds[0];
			const cost = visit.cost + edge.cost;
			if (cost >= (best.get(id)?.cost ?? Infinity)) continue;
			const next = { id, cost, previous: visit, edge };
			best.set(id, next);
			pending.add(next);
		}
	}
}
