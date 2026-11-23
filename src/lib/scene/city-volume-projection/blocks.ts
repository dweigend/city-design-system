import type { Vec2, Vec3 } from '../../core/geometry';
import { Random } from '../../core/random';
import {
	columnRoof,
	levelHeight,
	type CityColumn,
	type DistrictKind
} from '../../domain/city-volume';
import { stockPencilShare } from '../focus';
import { mesh } from './mesh';

/** Street half-width in meters between the stock box of a column and its plan cell edge. */
export const blockInset = 7;
/** A box keeps at least this share of its cell's size. */
const smallestBlock = 0.45;
/** Boxes sink this far below their lowest corner so they meet sloped ground. */
const footing = 0.5;

/** Stock boxes of one district kind, plain or drawn in pencil. */
export type BlockPart = {
	kind: DistrictKind;
	drawn: boolean;
	shape: ReturnType<typeof mesh>;
	outline: number[];
	storeys: number[];
	footprints: { ring: Vec3[]; top: number }[];
};

/** Whether a stock column is drawn in pencil: a keyed draw per plan cell, so the choice of one
 * column never depends on the others. */
export function drawnInPencil(seed: number) {
	const random = Random.create({ seed }).derive('stock-pencil');
	return (id: string) => random.derive(id).number() < stockPencilShare;
}

/** The cell ring scaled about its centroid so its nearest edge moves in by `blockInset`. */
function insetRing(ring: readonly Vec2[]): Vec2[] {
	const [cx, cy] = ring.reduce(
		([x, y], [u, v]) => [x + u / ring.length, y + v / ring.length],
		[0, 0]
	);
	let apothem = Infinity;
	for (const [i, [ax, ay]] of ring.entries()) {
		const [bx, by] = ring[(i + 1) % ring.length];
		const length = Math.hypot(bx - ax, by - ay);
		if (length > 1e-6)
			apothem = Math.min(apothem, Math.abs((bx - ax) * (ay - cy) - (by - ay) * (ax - cx)) / length);
	}
	const scale = Math.max(smallestBlock, 1 - blockInset / apothem);
	return ring.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}

function quad(shape: BlockPart['shape'], points: readonly Vec3[]) {
	const base = shape.positions.length / 3;
	for (const point of points) shape.positions.push(...point);
	for (let i = 1; i < points.length - 1; i++) shape.indices.push(base, base + i, base + i + 1);
}

/** Builds one plain box per column, a column's simplest drawing: its plan cell inset by a street,
 * from below its lowest terrain corner to its roof, with outline and storey lines. */
export function blockMeshes(
	columns: readonly CityColumn[],
	datumZ: number,
	toLocal: (x: number, y: number) => Vec2,
	seed: number
) {
	const parts = new Map<string, BlockPart>();
	const drawn = drawnInPencil(seed);
	for (const column of columns) {
		const pencil = drawn(column.planCellId);
		const id = `${column.kind}${pencil ? '/drawn' : ''}/block`;
		let part = parts.get(id);
		if (!part) {
			part = {
				kind: column.kind,
				drawn: pencil,
				shape: mesh(),
				outline: [],
				storeys: [],
				footprints: []
			};
			parts.set(id, part);
		}
		const top = columnRoof(column, datumZ);
		const bottom = Math.min(...column.corners.map(({ position }) => position[2])) - footing;
		const ring = insetRing(column.corners.map(({ position: [x, y] }) => toLocal(x, y)));
		part.footprints.push({ ring: ring.map(([x, y]): Vec3 => [x, y, bottom + footing]), top });
		quad(
			part.shape,
			ring.map(([x, y]): Vec3 => [x, y, top])
		);
		for (const [i, [ax, ay]] of ring.entries()) {
			const [bx, by] = ring[(i + 1) % ring.length];
			quad(part.shape, [
				[ax, ay, bottom],
				[bx, by, bottom],
				[bx, by, top],
				[ax, ay, top]
			]);
			part.outline.push(ax, ay, top, bx, by, top, ax, ay, bottom, ax, ay, top);
			for (
				let z = datumZ + levelHeight * Math.ceil((bottom - datumZ) / levelHeight + 0.5);
				z < top - 1e-6;
				z += levelHeight
			)
				part.storeys.push(ax, ay, z, bx, by, z);
		}
	}
	return parts;
}
