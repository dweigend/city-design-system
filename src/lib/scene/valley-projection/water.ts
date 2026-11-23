import type { ReachFrame } from './frame';

type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };
type Node = { x: number; y: number; bank: number; water: number };
type Side = readonly { x: number; y: number; z: number; water: number }[];

/** Water raster spacing in meters; the shore between nodes is interpolated. */
const waterCell = 50;

function nodes(frame: ReachFrame, width: number) {
	const columns = Math.ceil(frame.length / waterCell) + 1;
	const rows = Math.ceil(width / waterCell) + 1;
	const grid: Node[] = [];
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			const x = (column / (columns - 1) - 0.5) * frame.length;
			const y = (row / (rows - 1) - 0.5) * width;
			const { bank, water } = frame.sample(x, y);
			grid.push({ x, y, bank, water });
		}
	}
	return { columns, rows, grid };
}

/** Builds a flat water sheet over every wet area of the window, however many there are.
 * Marching squares on the signed bank distance place the shore between raster nodes; shared
 * nodes and crossings keep one welded mesh, so only shores and window edges form its boundary. */
export function waterSurface(frame: ReachFrame, width: number, scale: number): Mesh {
	const { columns, rows, grid } = nodes(frame, width);
	const mesh: Mesh = { kind: 'mesh', positions: [], indices: [] };
	const vertices = new Map<string, number>();
	const vertex = (key: string, x: number, y: number, water: number) => {
		let index = vertices.get(key);
		if (index === undefined) {
			index = mesh.positions.length / 3;
			mesh.positions.push(x, y, water * scale);
			vertices.set(key, index);
		}
		return index;
	};
	const corner = (i: number) => vertex(`n${i}`, grid[i].x, grid[i].y, grid[i].water);
	const crossing = (i: number, j: number) => {
		const [a, b] = i < j ? [grid[i], grid[j]] : [grid[j], grid[i]];
		const t = a.bank / (a.bank - b.bank);
		const key = `e${Math.min(i, j)}-${Math.max(i, j)}`;
		return vertex(
			key,
			a.x + t * (b.x - a.x),
			a.y + t * (b.y - a.y),
			a.water + t * (b.water - a.water)
		);
	};
	for (let row = 0; row + 1 < rows; row++) {
		for (let column = 0; column + 1 < columns; column++) {
			const base = row * columns + column;
			const ring = [base, base + 1, base + columns + 1, base + columns];
			const wet = ring.map((i) => grid[i].bank < 0);
			if (!wet.some(Boolean)) continue;
			const polygon: number[] = [];
			for (let k = 0; k < 4; k++) {
				const next = (k + 1) % 4;
				if (wet[k]) polygon.push(corner(ring[k]));
				if (wet[k] !== wet[next]) polygon.push(crossing(ring[k], ring[next]));
			}
			for (let k = 1; k + 1 < polygon.length; k++)
				mesh.indices.push(polygon[0], polygon[k], polygon[k + 1]);
		}
	}
	return mesh;
}

/** Closes the water body on the cut faces: a band from the water level down to the bed wherever
 * the ground lies below the water. Sides run in the skirt's order so their faces point outward. */
export function waterSections(sides: readonly Side[]): Mesh {
	const mesh: Mesh = { kind: 'mesh', positions: [], indices: [] };
	for (const side of sides) {
		for (let i = 1; i < side.length; i++) {
			const [a, b] = [side[i - 1], side[i]];
			if (a.water < a.z || b.water < b.z || (a.water === a.z && b.water === b.z)) continue;
			const start = mesh.positions.length / 3;
			mesh.positions.push(a.x, a.y, a.water, a.x, a.y, a.z, b.x, b.y, b.water, b.x, b.y, b.z);
			mesh.indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
		}
	}
	return mesh;
}
