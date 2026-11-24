import { eachNeighbor, type DrainageGrid } from './drainage-grid';

function priorityQueue(level: Int32Array) {
	const heap = new Int32Array(level.length);
	let size = 0;
	const before = (a: number, b: number) => level[a] < level[b] || (level[a] === level[b] && a < b);
	return {
		add(index: number) {
			let pos = size++;
			while (pos > 0) {
				const parent = (pos - 1) >>> 1;
				if (!before(index, heap[parent])) break;
				heap[pos] = heap[parent];
				pos = parent;
			}
			heap[pos] = index;
		},
		take() {
			const first = heap[0];
			const last = heap[--size];
			let pos = 0;
			for (let child = 1; child < size; child = pos * 2 + 1) {
				if (child + 1 < size && before(heap[child + 1], heap[child])) child++;
				if (!before(heap[child], last)) break;
				heap[pos] = heap[child];
				pos = child;
			}
			heap[pos] = last;
			return first;
		}
	};
}

// Exact arithmetic: unvisited is distinct from the outlet parent sentinel (-1).
const unvisited = /* Exact arithmetic: unvisited node sentinel. */ -2;

export function floodTerrain({ side, bed }: DrainageGrid) {
	const level = new Int32Array(bed.length);
	const parent = new Int32Array(bed.length).fill(unvisited);
	const order = new Int32Array(bed.length);
	const heap = priorityQueue(level);
	for (let i = 0; i < bed.length; i++) {
		const x = i % side;
		const y = (i / side) | 0;
		if (x > 0 && x < side - 1 && y > 0 && y < side - 1) continue;
		level[i] = bed[i];
		parent[i] = -1;
		heap.add(i);
	}
	for (let rank = 0; rank < order.length; rank++) {
		const i = heap.take();
		order[rank] = i;
		eachNeighbor(side, i, (next) => {
			if (parent[next] !== unvisited) return;
			level[next] = Math.max(level[i], bed[next]);
			parent[next] = i;
			heap.add(next);
		});
	}
	return { level, parent, order };
}
