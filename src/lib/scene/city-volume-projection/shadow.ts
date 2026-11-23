import type { Vec2, Vec3 } from '../../core/geometry';
import { columnRoof, type CityColumn, type DistrictKind } from '../../domain/city-volume';
import { shadowDirection, shadowReach } from '../stage';
import { mesh } from './mesh';

/** Ground shade per metre of height: a short dark contact band and the stage's longer cast shadow. */
export const shadowBands = { contact: 0.14, cast: shadowReach } as const;

type Point = Readonly<{ point: Vec3; reach: Vec2 }>;

function cross(o: Point, a: Point, b: Point) {
	const [ox, oy] = o.point;
	return (a.point[0] - ox) * (b.point[1] - oy) - (a.point[1] - oy) * (b.point[0] - ox);
}

/** Convex hull in counter-clockwise order (monotone chain). */
function hull(points: Point[]) {
	const sorted = [...points].sort((a, b) => a.point[0] - b.point[0] || a.point[1] - b.point[1]);
	const half = (list: Point[]) => {
		const chain: Point[] = [];
		for (const p of list) {
			while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0)
				chain.pop();
			chain.push(p);
		}
		chain.pop();
		return chain;
	};
	return [...half(sorted), ...half([...sorted].reverse())];
}

/** Flat ground shade of every column: its footprint swept along the sun by `reach` per metre of
 * roof height. The shade lies at the column's ground corners; the warp offsets stretch the swept
 * side with the display's vertical scale. */
export function shadowMeshes(
	columns: readonly CityColumn[],
	datumZ: number,
	toLocal: (x: number, y: number) => Vec2,
	reach: number
) {
	const parts = new Map<DistrictKind, { shape: ReturnType<typeof mesh>; warp: number[] }>();
	const [sx, sy] = shadowDirection;
	for (const column of columns) {
		let part = parts.get(column.kind);
		if (!part) {
			part = { shape: mesh(), warp: [] };
			parts.set(column.kind, part);
		}
		const top = columnRoof(column, datumZ);
		const ground = column.corners.map(({ position: [x, y, z] }): Vec3 => [...toLocal(x, y), z]);
		const points = ground.flatMap((point): Point[] => {
			const length = (top - point[2]) * reach;
			const offset: Vec2 = [sx * length, sy * length];
			return [
				{ point, reach: [0, 0] },
				{ point: [point[0] + offset[0], point[1] + offset[1], point[2]], reach: offset }
			];
		});
		const ring = hull(points);
		const base = part.shape.positions.length / 3;
		for (const { point, reach: offset } of ring) {
			part.shape.positions.push(...point);
			part.warp.push(...offset);
		}
		for (let i = 1; i < ring.length - 1; i++) part.shape.indices.push(base, base + i, base + i + 1);
	}
	return parts;
}
