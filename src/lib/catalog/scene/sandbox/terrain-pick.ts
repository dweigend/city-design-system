import * as THREE from 'three/webgpu';
import type { TerrainGrid, TerrainCell } from '../../logic/terrain-grid';
import type { Vec3 } from '../../logic/parametrik/types';

type Pick = { index: number; distance: number };
type Chunk = { cells: readonly TerrainCell[]; bounds: THREE.Box3 };

const position = (point: Vec3, out: THREE.Vector3) => out.set(point[0], point[2], -point[1]);

/** Picks the nearest parcel or refined court bank on its displayed triangles. */
export function createTerrainPicker() {
	let chunks: Chunk[] = [];
	const bankBounds = new WeakMap<TerrainCell, THREE.Box3>();
	const byCells = new WeakMap<readonly TerrainCell[], Chunk>();
	const [a, b, c, d, hit] = Array.from({ length: 5 }, () => new THREE.Vector3());

	function chunkOf(cells: readonly TerrainCell[]): Chunk {
		const known = byCells.get(cells);
		if (known) return known;
		const bounds = new THREE.Box3();
		for (const cell of cells) {
			if (cell.bank) {
				const box = new THREE.Box3();
				for (const p of cell.bank.points) box.expandByPoint(position(p, a));
				bankBounds.set(cell, box);
				bounds.union(box);
			}
			for (const corner of cell.corners) bounds.expandByPoint(position(corner, a));
		}
		const chunk = { cells, bounds };
		byCells.set(cells, chunk);
		return chunk;
	}

	function intersect(ray: THREE.Ray, cell: TerrainCell): number {
		const { corners } = cell;
		position(corners[0], a);
		position(corners[1], b);
		position(corners[2], c);
		position(corners[3], d);
		let distance = Infinity;
		if (ray.intersectTriangle(a, b, c, true, hit) || ray.intersectTriangle(a, c, d, true, hit))
			distance = ray.origin.distanceTo(hit);
		const bank = cell.bank;
		const box = bankBounds.get(cell);
		if (bank && box && ray.intersectsBox(box))
			for (let i = 0; i < bank.indices.length; i += 3) {
				position(bank.points[bank.indices[i]], a);
				position(bank.points[bank.indices[i + 1]], b);
				position(bank.points[bank.indices[i + 2]], c);
				if (ray.intersectTriangle(a, b, c, true, hit))
					distance = Math.min(distance, ray.origin.distanceTo(hit));
			}
		return distance;
	}

	return {
		/** Sets the current grid and shares bounds for unchanged chunks. */
		setGrid(grid: TerrainGrid) {
			chunks = [...grid.chunks.values()].map(chunkOf);
		},
		/** Nearest front-face hit in world meters, with the grid order breaking ties. */
		pick(ray: THREE.Ray, limit = Infinity): Pick | undefined {
			let best: Pick | undefined;
			let distance = limit;
			for (const chunk of chunks) {
				if (!ray.intersectsBox(chunk.bounds)) continue;
				for (const cell of chunk.cells) {
					const at = intersect(ray, cell);
					if (at > distance || !Number.isFinite(at)) continue;
					if (at === distance && best && cell.index > best.index) continue;
					best = { index: cell.index, distance: at };
					distance = at;
				}
			}
			return best;
		}
	};
}
