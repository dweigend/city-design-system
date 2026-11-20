import { interpolatePoint, type Vec3 } from '../parametrik/types';

export type PatchGrips = readonly [Vec3, Vec3, Vec3] | readonly [Vec3, Vec3, Vec3, Vec3];
const intervals = 8;

function gridRow(grips: PatchGrips, j: number): Vec3[] {
	const v = j / intervals;
	const end = grips.length === 4 ? intervals : intervals - j;
	const left = interpolatePoint(grips[0], grips[grips.length - 1], v);
	if (!end) return [[...grips[2]]];
	const right = interpolatePoint(grips[1], grips[2], v);
	return Array.from({ length: end + 1 }, (_, i) => interpolatePoint(left, right, i / end));
}

function stripFaces(lower: number[], upper: number[], faces: number[], row: number) {
	for (let i = 0; i < lower.length - 1; i++) {
		const a = lower[i],
			b = lower[i + 1],
			c = upper[i],
			d = upper[i + 1];
		if (d === undefined) faces.push(a, b, c);
		else if (lower.length === upper.length && (i + row) % 2 === 1) faces.push(a, b, d, a, d, c);
		else faces.push(a, b, c, b, d, c);
	}
}

/** Samples the ordered grip polygon and records every free hem from one grip to the next. */
export function patchGrid(grips: PatchGrips) {
	const positions: Vec3[] = [],
		faces: number[] = [],
		rows: number[][] = [];
	for (let j = 0; j <= intervals; j++) {
		const row = gridRow(grips, j).map((p) => positions.push(p) - 1);
		rows.push(row);
		if (j > 0) stripFaces(rows[j - 1], row, faces, j - 1);
	}
	const edges = [rows[0], rows.map((row) => row[row.length - 1])];
	if (grips.length === 4) edges.push(rows[intervals].toReversed());
	edges.push(rows.map((row) => row[0]).reverse());
	const pinned = positions.map(() => false);
	for (const [i, [corner]] of edges.entries()) {
		positions[corner] = [...grips[i]];
		pinned[corner] = true;
	}
	return { positions, faces, edges, pinned };
}
