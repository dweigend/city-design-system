import type { Typology } from './families';
import { housePartPlan, sectionParts, type planHouse } from '../composed-house';
import { bounds } from '../ansicht/geometrie';
function coverage(intervals: number[][]) {
	let end = -Infinity,
		covered = 0;
	for (const [a, b] of intervals.sort((a, b) => a[0] - b[0])) {
		covered += Math.max(0, b - Math.max(a, end));
		end = Math.max(end, b);
	}
	return covered;
}
function signature(s: ReturnType<typeof planHouse>) {
	const boxes = sectionParts(s).map((p) => {
		const b = bounds(p),
			outline = housePartPlan(p);
		for (const axis of [0, 1] as const) {
			b.min[axis] = Math.min(...outline.map((q) => q[axis]));
			b.max[axis] = Math.max(...outline.map((q) => q[axis]));
		}
		return b;
	});
	const bands = Math.ceil((Math.max(...boxes.map((b) => b.max[2])) - s.base[2]) / 2);
	const shares = [0, 1].flatMap((axis) =>
		Array.from({ length: bands }, (_, i) => {
			const start = s.base[2] + 2 * i;
			const slice = boxes.filter((b) => b.min[2] < start + 2 && b.max[2] > start);
			const edges = [
				...new Set([
					start,
					start + 2,
					...slice.flatMap((b) => [Math.max(start, b.min[2]), Math.min(start + 2, b.max[2])])
				])
			].sort((a, b) => a - b);
			return (
				edges.slice(1).reduce((area, z, j) => {
					const active = slice.filter((b) => b.min[2] < z && b.max[2] > edges[j]);
					return area + (z - edges[j]) * coverage(active.map((b) => [b.min[axis], b.max[axis]]));
				}, 0) /
				(2 * (axis ? s.composition.bay.depth : s.composition.bay.width))
			);
		})
	);
	return [shares.slice(0, bands), shares.slice(bands)];
}

function distance(a: number[][], b: number[][]) {
	const n = Math.max(a[0].length, b[0].length);
	return (
		a.reduce(
			(sum, view, k) =>
				sum +
				Array.from({ length: n }, (_, i) => Math.abs((view[i] ?? 0) - (b[k][i] ?? 0))).reduce(
					(x, y) => x + y,
					0
				),
			0
		) /
		(2 * n)
	);
}

function admits(type: Typology, height: number) {
	if (['courtyard-house', 'plinth-house', 'bridge-house'].includes(type)) return height <= 3;
	if (type === 'round-tower') return height >= 6;
	if (type === 'lattice-head') return height >= 5;
	return true;
}
type Specimen = ReturnType<typeof planHouse>;
type Minimum = { distance: number; other: Typology; cells: number; height: number };
function compare(
	minima: Map<Typology, Minimum>,
	samples: { type: Typology; fill: number[][] }[],
	cells: number,
	height: number
) {
	for (const a of samples)
		for (const b of samples) {
			if (a === b) continue;
			const d = distance(a.fill, b.fill);
			if (d < (minima.get(a.type)?.distance ?? Infinity))
				minima.set(a.type, { distance: d, other: b.type, cells, height });
		}
}
/** Measures the closest competing elevation profile on each shared admissible site. */
export function nearestSilhouettes(
	types: readonly Typology[],
	footprints: Record<Typology, number[]>,
	specimen: (n: number, type: Typology, height: number) => Specimen
) {
	const minima = new Map<Typology, Minimum>();
	for (const height of [3, 6])
		for (const cells of [1, 2, 4]) {
			const samples = types
				.filter((t) => footprints[t].includes(cells) && admits(t, height))
				.map((type) => ({ type, fill: signature(specimen(cells, type, height)) }));
			compare(minima, samples, cells, height);
		}
	return minima;
}
