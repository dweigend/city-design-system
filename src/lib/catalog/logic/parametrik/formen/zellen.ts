import type { FormContext, FormFamily, Point2 } from '../vocab';
import type { Primitive } from '../types';
import { area } from './geom';

/** Test cells for the form catalog: one footprint per cell shape, about 14 m across. */
export type CellShape = 'square' | 'triangle' | 'hex' | 'irregular';

const regular = (n: number, r: number, start: number): Point2[] =>
	Array.from({ length: n }, (_, i) => {
		const a = start + (i / n) * Math.PI * 2;
		return [Math.cos(a) * r, Math.sin(a) * r];
	});

export const testCells: Record<CellShape, { name: string; polygon: Point2[] }> = {
	square: {
		name: 'Square',
		polygon: [
			[-7, -7],
			[7, -7],
			[7, 7],
			[-7, 7]
		]
	},
	triangle: { name: 'Triangle', polygon: regular(3, 10, (Math.PI * 7) / 6) },
	hex: { name: 'Hexagon', polygon: regular(6, 8, (Math.PI * 4) / 3) },
	irregular: {
		name: 'Irregular',
		polygon: [
			[-6.5, -7.5],
			[7.5, -5.5],
			[6, 7],
			[-7.5, 5]
		]
	}
};

export const cellShapes = Object.keys(testCells) as CellShape[];

/** Height budget of one catalog cell in meters. */
export const CELL_HEIGHT = 18;

/** Same frame for every vignette: center and half height of the view in meters. */
export const catalogView = { center: [0, 0, 6.5] as [number, number, number], span: 13.5 };

/**
 * Form context on a test cell (see `polygonContext`). The footprint is the shared `testCells`
 * polygon by reference; generators must not mutate it.
 */
export function cellContext(shape: CellShape, seed: number): FormContext {
	return polygonContext(testCells[shape].polygon, seed);
}

/**
 * Context for any convex footprint: centroid as center, the longest edge (first one on a tie)
 * as orientation, the catalog height budget from z = 0.
 */
export function polygonContext(polygon: Point2[], seed: number): FormContext {
	// Centroid and dominant (longest) edge give center and orientation.
	let cx = 0,
		cy = 0,
		best = 0,
		orientation = 0;
	const a = area(polygon);
	for (let i = 0; i < polygon.length; i++) {
		const [x0, y0] = polygon[i],
			[x1, y1] = polygon[(i + 1) % polygon.length],
			f = x0 * y1 - x1 * y0;
		cx += (x0 + x1) * f;
		cy += (y0 + y1) * f;
		const len = Math.hypot(x1 - x0, y1 - y0);
		if (len > best + 1e-6) {
			best = len;
			orientation = Math.atan2(y1 - y0, x1 - x0);
		}
	}
	return {
		footprint: polygon,
		center: [cx / (6 * a), cy / (6 * a)],
		orientation,
		z: 0,
		height: CELL_HEIGHT,
		role: 'neu',
		seed
	};
}

/** Form on a test cell plus the cell outline as a gray plan line. */
export function formOnCell(
	family: FormFamily,
	shape: CellShape,
	params: Record<string, number>,
	seed: number,
	context: Partial<FormContext> = {}
): Primitive[] {
	const ctx = { ...cellContext(shape, seed), ...context };
	return [
		{
			id: 'cell-outline',
			kind: 'polyline',
			points: ctx.footprint.map(([x, y]) => [x, y, 0]),
			closed: true,
			role: 'bestand',
			token: '--paper',
			material: 'concrete'
		},
		...family.generate(ctx, params)
	];
}

/** Parameter record of a family with every spec at its default, in spec order. New object. */
export const defaults = (family: FormFamily) =>
	Object.fromEntries(family.params.map((p) => [p.key, p.default]));
