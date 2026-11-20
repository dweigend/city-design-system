import type { HouseComposition } from '../house-typology';
import type { Vec3 } from '../parametrik/types';
import { stationAt } from './shell-station';

type Shell = NonNullable<HouseComposition['exterior']>;

/** Fits continuous fields between surveyed corners, keeping each slot aligned across party seams. */
export function slottedWall(shell: Shell, index: number, start: number, end: number) {
	const next = (index + 1) % shell.ring.length;
	const a = shell.ring[index],
		b = shell.ring[next];
	const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
	const slots = width < 3 ? [] : width < 9 ? [0.5] : [0.38, 0.7];
	const half = Math.min(0.035, 0.35 / width);
	const edges = [0, ...slots.flatMap((u) => [u - half, u + half]), 1];
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (let i = 0; i < edges.length; i += 2) {
		const left = Math.max(start, edges[i]),
			right = Math.min(end, edges[i + 1]);
		if (left >= right) continue;
		for (const [j, { z }] of shell.stations.entries()) {
			const depth = j === shell.stations.length - 1 ? 1 : 0.24;
			const from = stationAt(shell, z, index, depth, 0);
			const to = stationAt(shell, z, next, depth, 0);
			const base = points.length;
			for (const u of [left, right])
				points.push([from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, z]);
			if (j) triangles.push(base - 2, base - 1, base + 1, base - 2, base + 1, base);
		}
	}
	return { points, triangles };
}
