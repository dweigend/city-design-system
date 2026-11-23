// The solve grid and its interpolant share the southwest–northeast diagonal.
// Heights are integer millimeters. Vertex order breaks all geometric ties.
import { floodTerrain } from './flood';
import { findBasins } from './basins';

import { eachNeighbor, vertexArea, type DrainageGrid } from './drainage-grid';

function route(side: number, { level, parent }: ReturnType<typeof floodTerrain>) {
	const receiver = parent.slice();
	for (let i = 0; i < level.length; i++) {
		if (parent[i] < 0) continue;
		let steepest = 0;
		eachNeighbor(side, i, (next, diagonal) => {
			const grade = (level[i] - level[next]) * (diagonal ? Math.SQRT1_2 : 1);
			if (grade > steepest || (grade > 0 && grade === steepest && next < receiver[i])) {
				receiver[i] = next;
				steepest = grade;
			}
		});
	}
	return receiver;
}

function accumulate(
	{ side, spacing, bed }: DrainageGrid,
	receiver: Int32Array,
	inlet: number,
	importedArea: number
) {
	const area = new Float64Array(bed.length);
	const incoming = new Int32Array(bed.length);
	const queue = new Int32Array(bed.length);
	let size = 0;
	for (let i = 0; i < bed.length; i++) {
		area[i] = vertexArea(side, spacing, i);
		if (receiver[i] >= 0) incoming[receiver[i]]++;
	}
	area[inlet] += importedArea;
	for (let i = 0; i < bed.length; i++) if (!incoming[i]) queue[size++] = i;
	for (let j = 0; j < size; j++) {
		const i = queue[j];
		const next = receiver[i];
		if (next < 0) continue;
		area[next] += area[i];
		if (!--incoming[next]) queue[size++] = next;
	}
	if (size !== bed.length) throw new Error('Drainage receivers contain a cycle');
	return area;
}

export function solveDrainage(
	grid: DrainageGrid,
	inlet: number,
	importedArea: number,
	spine: readonly { index: number }[] = []
) {
	const flood = floodTerrain(grid);
	const { level, parent, order } = flood;
	const receiver = route(grid.side, flood);
	const { basins, membership } = findBasins(grid, flood);
	const bed = grid.bed.slice();
	for (let i = 1; i < spine.length; i++) {
		const from = spine[i - 1].index;
		const to = spine[i].index;
		if (level[to] < level[from]) receiver[from] = to;
	}
	for (let i = 0; i < bed.length; i++) {
		const basin = basins[membership[i]];
		if (!basin) bed[i] = level[i];
		else receiver[i] = i === basin.root ? parent[i] : basin.root;
	}
	return {
		level,
		order,
		receiver,
		bed,
		area: accumulate(grid, receiver, inlet, importedArea),
		basins,
		membership
	};
}
