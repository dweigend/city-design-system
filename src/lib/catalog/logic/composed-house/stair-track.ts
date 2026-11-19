import type { HousePart } from './house-object';
import { houseStair } from '../../data/house-stair';
type XY = [number, number];
export type Station = { xy: XY; normal: XY };

/** Rigid tread stations on two semicircles with optional straight facade runs. */
export function stairTrack([x, y]: XY, angle: number, straight: number, half = 12) {
	const { going } = houseStair;
	const radius = going / (2 * Math.sin(Math.PI / (2 * half)));
	const result: Station[] = [];
	const tx = -Math.sin(angle),
		ty = Math.cos(angle);
	for (const sign of [1, -1]) {
		const start = angle + (sign === 1 ? 0 : Math.PI);
		for (let i = 0; i < half + straight; i++) {
			const a = start + (Math.PI * Math.min(i, half)) / half;
			const t = sign * (straight / 2 - Math.max(0, i - half)) * going;
			const normal: XY = [Math.cos(a), Math.sin(a)];
			result.push({
				xy: [x + t * tx + radius * normal[0], y + t * ty + radius * normal[1]],
				normal
			});
		}
	}
	return result;
}

/** Offsets a walking station to the edge of its tread or landing in metres. */
export function edge(station: Station, offset: number): XY {
	return [station.xy[0] + station.normal[0] * offset, station.xy[1] + station.normal[1] * offset];
}

/** Fourteen registered goings turn a 2.5-metre stair through a semicircle. */
export const publicStair = {
	width: 2.5,
	half: 14,
	radius: houseStair.going / (2 * Math.sin(Math.PI / 28))
} as const;

/** Joins two registry tread halves along the walking line, preserving level footings at curved turns. */
export function pairedTreads(
	stock: Extract<HousePart, { kind: 'prism' }>,
	id: string,
	a: Station,
	b: Station,
	z: number
) {
	const half = publicStair.width / 2;
	return [-1, 0].map((side, j) => ({
		...stock,
		id: id + (j ? '/outer' : ''),
		height: 0.12,
		z: z - 0.12,
		polygon: [
			edge(a, side * half),
			edge(b, side * half),
			edge(b, (side + 1) * half),
			edge(a, (side + 1) * half)
		]
	}));
}
