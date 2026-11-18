import { project, type Point } from './iso';

/**
 * Grid system. One unit U, stepped in decimals like graph paper.
 * Web: 1 U = 4 px. World: 1 U = 1 m. three.js: 1 world unit = 1 m.
 */
export const U = 4;

/** Vertical module: height of one story in meters. Single owner for every stacking system. */
export const STORY = 4;

/** Plot: 10 U = 40 px = 10 m. */
const FIELD = 10 * U;

export type GridLevel = { id: string; name: string; units: number; px: number };

export const gridLevels: GridLevel[] = [
	{ id: 'u1', name: 'Tick', units: 1 },
	{ id: 'u5', name: 'Module', units: 5 },
	{ id: 'u10', name: 'Plot', units: 10 },
	{ id: 'u50', name: 'Parcel', units: 50 },
	{ id: 'u100', name: 'Block', units: 100 }
].map((l) => ({ ...l, px: l.units * U }));

export type LineWeight = { id: string; name: string; token: string; px: number };

export const lineWeights: LineWeight[] = [
	{ id: 'hair', name: 'Hairline', token: '--hair', px: 1 },
	{ id: 'stroke', name: 'Line', token: '--stroke', px: 2 },
	{ id: 'bar', name: 'Bar', token: '--bar', px: 8 }
];

/* ---------- Drawing "Grid and lines" ----------
 * All coordinates are grid coordinates in px (multiples of 4).
 * How they land on pixels is governed by the convention in Paper.svelte.
 */

/** One drawing panel: 480 × 480 px = 12 × 12 plots. */
export const PANEL = 12 * FIELD;

/** Origin of the plan: one plot of margin. */
const PLAN: Point = [FIELD, FIELD];

export type Square = {
	id: string;
	units: number;
	x: number;
	y: number;
	size: number;
	label: Point;
};

/**
 * Plan: plot, parcel and block as squares sharing one corner.
 * The paper itself shows tick (1) and module (5).
 * Dimension line: number centered above the line on the right edge.
 */
export const planSquares: Square[] = gridLevels
	.filter((l) => l.units >= 10)
	.map((l) => ({
		id: l.id,
		units: l.units,
		x: PLAN[0],
		y: PLAN[1],
		size: l.px,
		label: [PLAN[0] + l.px, PLAN[1] - 2 * U]
	}));

const square = ([x, y]: Point, s: number): Point[] => [
	[x, y],
	[x + s, y],
	[x + s, y + s],
	[x, y + s]
];

/** Corners of the plot in the plan. */
export const planNodes: Point[] = square(PLAN, FIELD);

/** Origin of the isometric view: a 400 × 200 px rhombus, centered in the panel. */
const ISO: Point = [6 * FIELD, 3.5 * FIELD];
const CELL = 10;
const CELLS = 5;
const n = CELL * CELLS;

const at = (x: number, y: number): Point => {
	const [px, py] = project(x, y, 0);
	return [Math.round(ISO[0] + px), Math.round(ISO[1] + py)];
};
const poly = (pts: Point[]) => pts.map((p) => p.join(',')).join(' ');
const rhombus = (x: number, y: number, w: number, d: number) => [
	at(x, y),
	at(x + w, y),
	at(x + w, y + d),
	at(x, y + d)
];

/** Isometric view of a parcel (5 × 5 plots): outline, plot lines, corners of one plot. */
export const iso = {
	outline: poly(rhombus(0, 0, n, n)),
	lines: Array.from({ length: CELLS - 1 }, (_, i) => (i + 1) * CELL).flatMap((v) => [
		[at(v, 0), at(v, n)],
		[at(0, v), at(n, v)]
	]) as [Point, Point][],
	/** Corners of the plot: they sit on the paper's 20 px nodes. */
	nodes: rhombus(0, 0, CELL, CELL)
};
