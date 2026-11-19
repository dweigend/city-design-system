import { STORY } from '../../../data/grid';
import type { Vec3 } from '../../parametrik/types';
import { block, plate } from '../assembly';
import { surface } from '../parts';
import { houseSeries, lengths } from './house-series';
import { rounded } from './kit-recipe';
import { suggestions } from './suggestions';

const depth = 5,
	reveal = 0.35,
	radius = 0.45;
type Point = [number, number];

// Cut the doorway into the middle of the left end before extruding the sill.
function doorCourse(span: number, height: number) {
	const contour = rounded(0, 0, 0, span, depth, height, 'body', radius);
	if (contour.kind !== 'prism') throw new Error('Expected a solid storey section');
	const x = -span / 2;
	contour.polygon.splice(
		contour.polygon.length / 2,
		0,
		[x, 0.55],
		[x + reveal, 0.55],
		[x + reveal, -0.55],
		[x, -0.55]
	);
	return contour;
}

// The outside of each cell is rectangular. Its inner circle continues to the glass plane.
function portRow(span: number, y: number, z: number) {
	const points: Vec3[] = [],
		triangles: number[] = [];
	const count = Math.round(span / 1.4),
		pitch = span / count,
		side = Math.sign(y);
	for (let cell = 0; cell < count; cell++) {
		const cx = (cell + 0.5) * pitch - span / 2,
			start = points.length;
		for (let i = 0; i < 32; i++) {
			const angle = Math.PI * (i / 16 + 0.25),
				x = Math.cos(angle),
				h = Math.sin(angle),
				edge = Math.max(Math.abs(x), Math.abs(h));
			points.push(
				[cx + ((x / edge) * pitch) / 2, y, z + (h / edge) * 0.36],
				[cx + x * 0.29, y, z + h * 0.29],
				[cx + x * 0.29, y - side * reveal, z + h * 0.29]
			);
		}
		for (let i = 0; i < 32; i++) {
			const a = start + 3 * i,
				b = start + 3 * ((i + 1) % 32);
			const faces = [a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2];
			triangles.push(...(side > 0 ? faces : faces.reverse()));
		}
	}
	return { ...surface('body'), kind: 'mesh' as const, points, triangles, lines: [] };
}

function band(span: number, storeys: number, v: number) {
	const h = storeys * STORY,
		sill = h - 1.36,
		belt = 0.72;
	const stock = [
		doorCourse(span, 2.1),
		block(-span / 2 + reveal - 0.01, 0, 0, 0.02, 1.1, 2.1, 'trim')
	];
	if (sill > 2.1) stock.push(rounded(0, 0, 2.1, span, depth, sill - 2.1, 'body', radius));
	stock.push(
		rounded(0, 0, sill + belt, span, depth, h - sill - belt, 'body', radius),
		rounded(0, 0, sill, span - 2 * reveal, depth - 2 * reveal, belt, 'glass', radius)
	);
	const capWidth = 0.72;
	for (const side of [-1, 1]) {
		if (v === 2 && side === 1) continue;
		stock.push(rounded((side * (span - capWidth)) / 2, 0, sill, capWidth, depth, belt, 'body'));
	}
	if (v === 1)
		for (const side of [-1, 1])
			stock.push(portRow(span - 2 * capWidth, (side * depth) / 2, sill + belt / 2));
	return stock;
}

function plinth(span: number, v: number) {
	const h = 0.6 + 0.3 * v,
		b = 0.45,
		x = span / 2,
		y = depth / 2;
	const outline: Point[] = [
		[-x + b, -y],
		[x - b, -y],
		[x, -y + b],
		[x, y - b],
		[x - b, y],
		[-x + b, y],
		[-x, y - b],
		[-x, -y + b]
	];
	return [plate(outline, 0, h, 'body')];
}
export const storeyKit = [
	...[1, 2].flatMap((n) =>
		houseSeries(
			'band-body-' + n + 's',
			lengths,
			(l) => [l, depth],
			['body', 'glass', 'trim'],
			['plain', 'porthole-row', 'corner-window'],
			(l, v) => band(l, n, v)
		).map((r) => ({
			...r,
			suggestions: { body: suggestions.body, glass: suggestions.diffuser, trim: suggestions.frame }
		}))
	),
	...houseSeries(
		'plinth-chamfer',
		lengths,
		(l) => [l, depth],
		['body'],
		['low', 'standard', 'high'],
		plinth
	).map((r) => ({ ...r, suggestions: { body: suggestions.foot } }))
];
