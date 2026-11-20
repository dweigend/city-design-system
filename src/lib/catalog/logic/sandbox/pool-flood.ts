import type { BankSurface, TerrainCell } from '../terrain-grid';
import type { Vec3 } from '../parametrik/types';

type Flood = { vertices: Map<string, number>; parent: number[] };
const address = (p: Vec3) => Math.round(p[0] * 1e6) + '/' + Math.round(p[1] * 1e6);

function root(parent: number[], id: number): number {
	while (parent[id] !== id) {
		parent[id] = parent[parent[id]];
		id = parent[id];
	}
	return id;
}

function station(flood: Flood, p: Vec3) {
	const key = address(p),
		known = flood.vertices.get(key);
	if (known !== undefined) return known;
	const id = flood.parent.length;
	flood.vertices.set(key, id);
	flood.parent.push(id);
	return id;
}

// Two wet bed triangles communicate through any vertex strictly below the
// waterline. A retained parcel can split off a dry hollow behind a saddle.
function submerged(flood: Flood, bank: BankSurface, level: number) {
	const ids = bank.points.map((p) => (p[2] < level ? station(flood, p) : -1));
	const faces: { start: number; id: number }[] = [];
	for (let i = 0; i < bank.indices.length; i += 3) {
		const wet = bank.indices
			.slice(i, i + 3)
			.map((k) => ids[k])
			.filter((k) => k >= 0);
		if (!wet.length) continue;
		const head = root(flood.parent, wet[0]);
		for (const id of wet.slice(1)) flood.parent[root(flood.parent, id)] = head;
		faces.push({ start: i, id: head });
	}
	return faces;
}

function mainBasin(parent: number[]) {
	const counts = new Map<number, number>();
	let main = -1,
		largest = 0;
	for (let i = 0; i < parent.length; i++) {
		const id = root(parent, i),
			count = (counts.get(id) ?? 0) + 1;
		counts.set(id, count);
		if (count > largest) {
			main = id;
			largest = count;
		}
	}
	return main;
}

/** Fills the largest connected depression at a district's waterline. Pockets
 * separated by dry foundations keep their ground and remain outside the pool. */
export function floodPool(cells: TerrainCell[], level: number) {
	const flood: Flood = { vertices: new Map(), parent: [] };
	const channels = cells.map((cell) =>
		cell.bank?.water === level ? submerged(flood, cell.bank, level) : []
	);
	const main = mainBasin(flood.parent);
	return cells.map((cell, i) => {
		const bank = cell.bank;
		if (!bank || bank.water !== level) return cell;
		const waterFaces = channels[i]
			.filter((f) => root(flood.parent, f.id) === main)
			.flatMap((f) => bank.indices.slice(f.start, f.start + 3));
		if (!waterFaces.length) return { ...cell, bank: { ...bank, water: undefined } };
		return { ...cell, buildable: false, plantable: false, bank: { ...bank, waterFaces } };
	});
}
