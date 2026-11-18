/**
 * 2:1 dimetric projection, the same as the three.js camera
 * (orthographic, azimuth 45°, elevation 30°). Dimensions in meters.
 * At S = 4 px/m, a 10 × 10 m cell becomes an 80 × 40 px rhombus
 * whose corners sit on the 20 px nodes of the paper grid.
 */
export const S = 4;
const H = 1.2247;

export type Point = [number, number];
export type Box = { x: number; y: number; z: number; w: number; d: number; h: number };
export type BoxFaces = { top: string; left: string; right: string };

export function project(x: number, y: number, z: number, s = S): Point {
	return [(x - y) * s, ((x + y) * 0.5 - z * H) * s];
}

const toPath = (pts: Point[]) => pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

/** Visible faces of a box. */
export function boxFaces({ x, y, z, w, d, h }: Box, s = S): BoxFaces {
	const P = (a: number, b: number, c: number) => project(a, b, c, s);
	return {
		top: toPath([P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)]),
		left: toPath([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)]),
		right: toPath([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)])
	};
}

/** Bounding rectangle of all boxes as an SVG viewBox (with padding in px). */
export function viewBoxOf(boxes: Box[], pad = 4, s = S): string {
	const pts = boxes.flatMap(({ x, y, z, w, d, h }) =>
		[x, x + w].flatMap((a) => [y, y + d].flatMap((b) => [z, z + h].map((c) => project(a, b, c, s))))
	);
	const xs = pts.map((p) => p[0]);
	const ys = pts.map((p) => p[1]);
	const minX = Math.min(...xs) - pad;
	const minY = Math.min(...ys) - pad;
	return `${minX} ${minY} ${Math.max(...xs) + pad - minX} ${Math.max(...ys) + pad - minY}`;
}

export type Building = { id: string; label: string; boxes: Box[] };

/** Buildings on one plot (10 × 10 m), floor = 4 m. */
export const buildings: Building[] = [
	{
		id: 'house',
		label: 'House',
		boxes: [
			{ x: 0, y: 0, z: 0, w: 10, d: 10, h: 8 },
			{ x: 2, y: 2, z: 8, w: 5, d: 6, h: 4 }
		]
	},
	{
		id: 'tower',
		label: 'Tower',
		boxes: [
			{ x: 0, y: 0, z: 0, w: 10, d: 10, h: 4 },
			{ x: 2, y: 2, z: 4, w: 6, d: 6, h: 24 }
		]
	},
	{
		id: 'hall',
		label: 'Hall',
		boxes: [
			{ x: 0, y: 0, z: 0, w: 20, d: 10, h: 8 },
			{ x: 13, y: 2, z: 8, w: 5, d: 5, h: 4 }
		]
	}
];

export type Lot = { box: Box; category: string; label: string };

/** Small sample city: one block of plots, a main alley. */
export const miniCity: Lot[] = [
	{
		box: { x: 0, y: 0, z: 0, w: 20, d: 20, h: 16 },
		category: 'living',
		label: 'Housing block north'
	},
	{ box: { x: 30, y: 0, z: 0, w: 10, d: 10, h: 40 }, category: 'business', label: 'Office tower' },
	{ box: { x: 30, y: 10, z: 0, w: 10, d: 10, h: 12 }, category: 'business', label: 'Shop' },
	{ box: { x: 0, y: 30, z: 0, w: 20, d: 10, h: 8 }, category: 'health', label: 'Clinic' },
	{ box: { x: 30, y: 30, z: 0, w: 10, d: 10, h: 1 }, category: 'nature', label: 'Park' },
	{ box: { x: 23, y: -10, z: 0, w: 2, d: 60, h: 0.4 }, category: 'mobility', label: 'Main alley' },
	{ box: { x: -10, y: 23, z: 0, w: 60, d: 2, h: 0.4 }, category: 'mobility', label: 'Main alley' }
];

/** Faces of the city in drawing order (back to front), with category. */
export function cityFaces(lots: Lot[]): { faces: BoxFaces; category: string }[] {
	return [...lots]
		.sort((a, b) => a.box.x + a.box.y - (b.box.x + b.box.y))
		.map((l) => ({ faces: boxFaces(l.box), category: l.category }));
}
