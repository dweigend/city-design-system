import { yarnIntervals } from './cloth';

type Sample = (u: number, v: number) => number;
const fitted = new WeakMap<Float64Array, Sample>();

function cellShape(u: number, v: number, bays: number) {
	if (u === 0 || u === 1 || v === 0 || v === 1) return 0;
	const phase = u * bays;
	const sine = (x: number) => Math.sin(Math.PI * x);
	// The two diagonal cable coordinates vanish on opposite sides of each diamond.
	const dome = Math.abs(sine(phase + v / 2) * sine(phase - v / 2));
	return dome * sine(v) * Math.sin(Math.PI * Math.min(0.5, phase, bays - phase));
}

/** Fits the smooth fundamental cell mode to the solved yarn displacements in metres. */
export function netCell(field: Float64Array, yarnCols: number): Sample {
	const previous = fitted.get(field);
	if (previous) return previous;
	const bays = yarnCols / yarnIntervals;
	let load = 0,
		area = 0;
	for (let j = 1; j < yarnIntervals; j++) {
		for (let i = 1; i < yarnCols; i++) {
			const shape = cellShape(i / yarnCols, j / yarnIntervals, bays);
			load += shape * field[j * (yarnCols + 1) + i];
			area += shape * shape;
		}
	}
	const amplitude = load / area;
	const sample: Sample = (u, v) => amplitude * cellShape(u, v, bays);
	fitted.set(field, sample);
	return sample;
}
