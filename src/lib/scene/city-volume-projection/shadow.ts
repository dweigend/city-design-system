import type { Vec2, Vec3 } from '../../core/geometry';
import { shadowDirection, shadowReach } from '../stage';
import { contactShadeReachPerM } from '../../../config/city-volume-projection';
import { mesh } from './mesh';

/** Ground shade per metre of height: a short dark contact band and the stage's longer cast shadow. */
export const shadowBands = { contact: contactShadeReachPerM, cast: shadowReach } as const;

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

/** Flat ground shade of every body: its footprint swept along the sun by `reach` per metre of
 * roof height. The shade lies at the footprint's ground; the warp offsets stretch the swept side
 * with the display's vertical scale. */
export function shadowMesh(
	footprints: readonly Readonly<{ ring: readonly Vec3[]; top: number }>[],
	reach: number
) {
	const shape = mesh();
	const warp: number[] = [];
	const [sx, sy] = shadowDirection;
	for (const { ring: footprint, top } of footprints) {
		const points = footprint.flatMap((point): Point[] => {
			const length = (top - point[2]) * reach;
			const offset: Vec2 = [sx * length, sy * length];
			return [
				{
					point,
					reach: /* Exact arithmetic: the base edge has no projected displacement. */ [0, 0]
				},
				{ point: [point[0] + offset[0], point[1] + offset[1], point[2]], reach: offset }
			];
		});
		const ring = hull(points);
		const base = shape.positions.length / 3;
		for (const { point, reach: offset } of ring) {
			shape.positions.push(...point);
			warp.push(...offset);
		}
		for (let i = 1; i < ring.length - 1; i++) shape.indices.push(base, base + i, base + i + 1);
	}
	return { shape, warp };
}
