import { kitRecipe } from './kit-recipe';
import type { ObjectGeometry } from '../object-geometry';
import { block } from '../assembly';
type Slots = Parameters<typeof kitRecipe>[3];
/** Registers named deck furnishings with their own reserved dimensions and geometry variants. */
export function streetSeries(
	family: string,
	models: readonly string[],
	footprint: (i: number) => [number, number],
	slots: Slots,
	variants: readonly string[],
	draw: (i: number, v: number) => ObjectGeometry[]
) {
	return models.map((model, i) =>
		kitRecipe(
			'street-life-' + family + '-' + model,
			'street-furniture',
			footprint(i),
			slots,
			variants,
			(v) => draw(i, v)
		)
	);
}
export const lengths = [1.25, 2.5, 3.75, 5];
export const lengthNames = ['1p25m', '2p5m', '3p75m', '5m'];
/** Four legs measured between the underside of a top and the mounting plane. */
export function supports(w: number, d: number, h: number) {
	return [-1, 1].flatMap((s) =>
		[-1, 1].map((t) => block(s * (w / 2 - 0.15), t * (d / 2 - 0.15), 0, 0.3, 0.3, h, 'frame'))
	);
}
