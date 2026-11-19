import { kitRecipe } from './kit-recipe';
import type { ObjectGeometry } from '../object-geometry';
type Slots = Parameters<typeof kitRecipe>[3];
/** Registers each purchasable module size separately so its reservation fits its own sockets. */
export function houseSeries(
	name: string,
	sizes: readonly number[],
	footprint: (size: number) => [number, number],
	slots: Slots,
	variants: readonly string[],
	draw: (size: number, v: number) => ObjectGeometry[]
) {
	return sizes.map((size) =>
		kitRecipe(
			'kit-' + name + '-' + String(size).replace('.', 'p') + 'm',
			'house-fittings',
			footprint(size),
			slots,
			variants,
			(v) => draw(size, v)
		)
	);
}
export const spans = [2.5, 5, 7.5];
export const courses = [2, 4, 6];
export const lengths = [5, 7.5, 10];
/** Rounds the plan reservation up to the next 1.25 m module. */
export function moduleSpan(m: number) {
	return Math.ceil(m / 1.25) * 1.25;
}
