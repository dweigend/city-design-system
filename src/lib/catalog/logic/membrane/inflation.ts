import { solveYarns, yarnIntervals, yarnOpening, type Membrane } from './cloth';

import { netCell } from './net-cell';

export type { Membrane } from './cloth';

// Three surface intervals per yarn interval retain the slit endpoints on the refined mesh.
const refinement = 3;
export const clothIntervals = yarnIntervals * refinement;
const cache = new WeakMap<Float64Array, Float64Array>();

/** Maps a refined surface quad to its material cut on the solver lattice. */
export function clothOpening(i: number, j: number) {
	return yarnOpening(Math.floor(i / refinement), Math.floor(j / refinement));
}

// A cubic B-spline averages four neighbouring deflections with nonnegative weights.
function stencil(x: number, end: number) {
	const i = Math.floor(x);
	const t = x - i;
	const weights = [
		(1 - t) ** 3,
		4 - 6 * t ** 2 + 3 * t ** 3,
		1 + 3 * t + 3 * t ** 2 - 3 * t ** 3,
		t ** 3
	];
	return weights.map((weight, k) => ({
		index: Math.max(0, Math.min(end, i + k - 1)),
		weight: weight / 6
	}));
}

function smoothRows(field: Float64Array, cols: number, refinedCols: number) {
	const samples = Array.from({ length: refinedCols + 1 }, (_, i) => stencil(i / refinement, cols));
	return Array.from({ length: yarnIntervals + 1 }, (_, j) =>
		samples.map((column) =>
			column.reduce((sum, s) => sum + s.weight * field[j * (cols + 1) + s.index], 0)
		)
	);
}

// Round the strap groove over its width.
function tieProfile(phase: number) {
	const wave = Math.sin(Math.PI * phase);
	return wave ** 2 / (0.12 + 0.88 * wave ** 2);
}

function seamProfile(restraint: Membrane['restraint'], i: number, j: number, cols: number) {
	if (!i || !j || i === cols || j === clothIntervals) return 0;
	const phase = i / clothIntervals;
	if (restraint === 'straps') return tieProfile(phase);

	return 1;
}

/** Reconstructs a smooth displacement field in metres from the pressure solve, pinning restraint lines. */
export function simulateCloth(fabric: Membrane, cols: number, width: number, height: number) {
	const yarnCols = cols / refinement;
	const field = solveYarns(fabric, yarnCols, width, height);
	const previous = cache.get(field);
	if (previous) return previous;
	if (fabric.restraint === 'net') {
		const sample = netCell(field, yarnCols);
		const surface = Float64Array.from({ length: (cols + 1) * (clothIntervals + 1) }, (_, k) =>
			sample((k % (cols + 1)) / cols, Math.floor(k / (cols + 1)) / clothIntervals)
		);
		cache.set(field, surface);
		return surface;
	}
	const rows = smoothRows(field, yarnCols, cols);
	const surface = new Float64Array((cols + 1) * (clothIntervals + 1));
	for (let j = 0; j <= clothIntervals; j++) {
		const row = stencil(j / refinement, yarnIntervals);
		for (let i = 0; i <= cols; i++) {
			const displacement = row.reduce((sum, s) => sum + s.weight * rows[s.index][i], 0);
			surface[j * (cols + 1) + i] = displacement * seamProfile(fabric.restraint, i, j, cols);
		}
	}
	cache.set(field, surface);
	return surface;
}
