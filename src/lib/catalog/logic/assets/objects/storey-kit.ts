import { STORY } from '../../../data/grid';
import { castCourse } from './cast-edge';
import { block, plate } from '../assembly';
import { bandCollars } from './band-collars';
import { houseSeries, lengths, moduleSpan } from './house-series';
import { rounded } from './kit-recipe';
import { suggestions } from './suggestions';

const reveal = 0.35;
const bodySpans = [2.5, 3.75, ...lengths];
const planDepth = (span: number) => Math.min(5, span);
const cornerRadius = (span: number): 0.3 | 0.45 => (span < 5 ? 0.3 : 0.45);
type Point = [number, number];

function windowCourse(span: number, sill: number, v: number, entry: boolean) {
	const depth = planDepth(span),
		radius = cornerRadius(span);
	const left = rounded(-(span - 0.85) / 2, 0, sill, 0.85, depth, 1, 'body');
	if (entry && left.kind === 'prism') {
		const x = -span / 2;
		left.polygon.splice(
			left.polygon.length / 2,
			0,
			[x, 0.55],
			[x + reveal, 0.55],
			[x + reveal, -0.55],
			[x, -0.55]
		);
	}
	const stock = [
		rounded(0, 0, sill, span - 2 * reveal, depth - 2 * reveal, 1, 'glass', radius),
		left
	];
	if (v !== 2)
		for (const side of [-1, 1])
			stock.push(rounded(span / 2 - 0.32, side * (depth / 2 - 0.32), sill, 0.64, 0.64, 1, 'body'));
	if (v === 1) stock.push(bandCollars(span, depth, reveal, sill + 0.5));
	return stock;
}

function band(span: number, storeys: number, v: number) {
	const depth = planDepth(span),
		radius = cornerRadius(span);
	const stock = [
		castCourse(span, depth, 0, 1, false, radius),
		block(-span / 2 + reveal - 0.06, 0, 0, 0.12, 1.1, 2, 'trim')
	];
	for (let floor = 0; floor < storeys; floor++) {
		const sill = floor * STORY + 1;
		stock.push(...windowCourse(span, sill, v, floor === 0));
		stock.push(
			floor === storeys - 1
				? castCourse(span, depth, sill + 1, STORY - 2, true, radius)
				: rounded(0, 0, sill + 1, span, depth, STORY - 1, 'body', radius)
		);
	}
	return stock;
}

function plinth(span: number, v: number) {
	const h = 0.6 + 0.3 * v,
		b = cornerRadius(span),
		x = span / 2 + 0.3,
		y = planDepth(span) / 2 + 0.3;
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
			bodySpans,
			(l) => [l, planDepth(l)],
			['body', 'glass', 'trim'],
			['plain', 'porthole-row', 'corner-window'],
			(l, v) => band(l, n, v)
		).map((r) => ({
			...r,
			suggestions: {
				body: suggestions.body,
				glass: {
					material: 'glass' as const,
					finish: 'glas-matt' as const,
					token: '--ink' as const
				},
				trim: suggestions.frame
			}
		}))
	),
	...houseSeries(
		'plinth-chamfer',
		bodySpans,
		(l) => [moduleSpan(l + 0.6), moduleSpan(planDepth(l) + 0.6)],
		['body'],
		['low', 'standard', 'high'],
		plinth
	).map((r) => ({ ...r, suggestions: { body: suggestions.foot } }))
];
