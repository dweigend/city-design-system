import { eachNeighbor, type DrainageGrid } from './drainage-grid';
import type { floodTerrain } from './flood';

export type Basin = { root: number; outlet: number; level: number; area: number; depth: number };

function fraction(a: number, b: number, c: number) {
	if (a >= 0) return 0;
	if (c <= 0) return 1;
	if (b >= 0) return (a / (a - b)) * (a / (a - c));
	return 1 - (c / (c - a)) * (c / (c - b));
}

function basinsByVertex(
	{ side, bed }: DrainageGrid,
	{ level, order, parent }: ReturnType<typeof floodTerrain>
) {
	const membership = new Int32Array(bed.length).fill(-1);
	const pending = new Int32Array(bed.length);
	const basins: Basin[] = [];
	for (const root of order) {
		if (membership[root] >= 0 || bed[root] >= level[root]) continue;
		const id = basins.length;
		const spill = level[root];
		const basin = { root, outlet: parent[root], level: spill, area: 0, depth: 0 };
		basins.push(basin);
		membership[root] = id;
		pending[0] = root;
		let count = 1;
		for (let j = 0; j < count; j++) {
			const i = pending[j];
			basin.depth = Math.max(basin.depth, spill - bed[i]);
			eachNeighbor(side, i, (next) => {
				if (membership[next] >= 0 || level[next] !== spill || bed[next] >= spill) return;
				membership[next] = id;
				pending[count++] = next;
			});
		}
	}
	return { basins, membership };
}

export function findBasins(grid: DrainageGrid, flood: ReturnType<typeof floodTerrain>) {
	const { side, bed, spacing } = grid;
	const { basins, membership } = basinsByVertex(grid, flood);
	const triangleArea = (spacing * spacing) / 2;
	const measure = (a: number, b: number, c: number) => {
		const id = Math.max(membership[a], membership[b], membership[c]);
		if (id < 0) return;
		const basin = basins[id];
		const low = Math.min(bed[a], bed[b], bed[c]);
		const high = Math.max(bed[a], bed[b], bed[c]);
		const mid = bed[a] + bed[b] + bed[c] - low - high;
		const z = basin.level;
		basin.area += triangleArea * fraction(low - z, mid - z, high - z);
	};
	for (let row = 0; row < side - 1; row++) {
		for (let a = row * side; a < row * side + side - 1; a++) {
			const c = a + side + 1;
			measure(a, a + 1, c);
			measure(a, c, c - 1);
		}
	}
	const retained: Basin[] = [];
	const ids = basins.map((basin) => {
		if (basin.area < 20_000 || basin.depth < 1000) return -1;
		return retained.push(basin) - 1;
	});
	for (let i = 0; i < bed.length; i++) if (membership[i] >= 0) membership[i] = ids[membership[i]];
	return { basins: retained, membership };
}
