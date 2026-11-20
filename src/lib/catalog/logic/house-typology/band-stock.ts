import { assetRegistry } from '../assets';

import type { Body, Point } from './types';

const bands = assetRegistry
	.filter((a) => a.id.startsWith('kit-band-body-'))
	.map((a) => ({
		id: a.id,
		span: a.footprint[0],
		depth: a.footprint[1],
		height: a.id.includes('-2s-') ? 8 : 4,
		variants: a.variants
	}));
type Stock = (typeof bands)[number];
type Fit = { stock: Stock; scale: number; counts: Point; extent: Point; coverage: number };

function scales(max: number, variable: boolean) {
	return variable ? [max, max - 0.015, max - 0.035, max - 0.07, max - 0.12, 0.85] : [max];
}
function courseFits(stock: Stock, size: Point, counts: Point, variable: boolean): Fit[] {
	const [w, d, h] = size,
		[nx, ny, nz] = counts;
	const span = nx * stock.span,
		depth = ny * stock.depth,
		height = nz * stock.height;
	const max = variable ? Math.min(1.15, w / span, d / depth) : h / height;
	return scales(max, variable)
		.filter((s) => s >= 0.85 - 1e-7 && s <= 1.15 && span * s <= w + 1e-7 && depth * s <= d + 1e-7)
		.map((scale) => ({
			stock,
			scale,
			counts,
			extent: [span * scale, depth * scale, height * scale],
			coverage: (span * depth * scale * scale) / (w * d)
		}));
}
function fits(stock: Stock, size: Point, freeHeight: boolean) {
	const nz = Math.max(1, Math.round(size[2] / stock.height));
	const result: Fit[] = [];
	for (let nx = 1; nx * stock.span * 0.85 <= size[0] + 1e-7; nx++)
		for (let ny = 1; ny * stock.depth * 0.85 <= size[1] + 1e-7; ny++)
			for (const courses of freeHeight && nz > 1 ? [nz, nz - 1] : [nz])
				result.push(...courseFits(stock, size, [nx, ny, courses], freeHeight));
	return result;
}

/** Chooses the released span and number of uniformly scaled modules that fill the surveyed envelope. */
export function fitBandStock(
	body: Body,
	coverage: number,
	freeHeight = false,
	accept: (extent: Point) => boolean = () => true
) {
	if (!body.band || body.band.court) return;
	const options = bands
		.flatMap((s) => fits(s, body.size, freeHeight))
		.filter((s): s is Fit => !!s && s.coverage >= coverage && accept(s.extent));
	options.sort(
		(a, b) =>
			b.coverage - a.coverage ||
			a.counts.reduce((n, c) => n * c, 1) - b.counts.reduce((n, c) => n * c, 1)
	);
	const best = options[0];
	if (!best) return;
	const { stock, scale, counts, extent } = best;
	const phase = Number(body.id.split('/level/')[1]?.split('/')[0] ?? 0);
	const variant = stock.variants[((body.seed + phase) >>> 0) % stock.variants.length];
	Object.assign(body, {
		objectId: stock.id,
		variant,
		nativeSize: [stock.span, stock.depth, stock.height],
		nativeCenter: [0, 0, 0],
		scale
	});
	body.band.modules = counts;
	return extent;
}
