import { Random } from '../../core/random';
import { defaults } from '../../../config/house-court';
import { cellAreaM2, type CellSpace } from '../cell-space';
import type { HouseStyle } from './styles';

const { calmAreaM2, cellsPerColour, largeUnitAreaM2 } = defaults;

/** How the house rule reads a cell space: `calm` for a small town parcel, `large` for one
 * building over a large unit, `regular` for everything between (the R11 fixtures). */
export type HouseScale = 'calm' | 'regular' | 'large';

/** The scale of a cell space by its area: large from the large unit area, calm up to the calm
 * area, regular otherwise. */
export function houseScale(space: CellSpace): HouseScale {
	const area = space.cells.reduce((sum, cell) => sum + cellAreaM2(cell), 0);
	if (area >= largeUnitAreaM2) return 'large';
	return area <= calmAreaM2 ? 'calm' : 'regular';
}

/** True when a cell side opens onto a shared court beyond the parcel. */
export function hasCourtAccess(space: CellSpace): boolean {
	return space.cells.some(({ sides }) => sides.some(({ court }) => court));
}

/** Draws `count` distinct entries of a list in seeded order, or the list when it is shorter. */
function draw<T>(random: Random, key: string, list: readonly T[], count: number): T[] {
	const unique = [...new Set(list)];
	const stream = random.derive(key);
	const keyed = unique.map((item) => ({ item, rank: stream.number() }));
	return keyed
		.sort((a, b) => a.rank - b.rank)
		.slice(0, Math.max(1, count))
		.map(({ item }) => item);
}

/** The style row as one house of this scale applies it. A calm house draws one fill, roof and
 * opening kind, one roof colour and one body colour per `cellsPerColour` cells from the row, so
 * neighbours differ by seed while each house stays quiet; a large building takes the row's large
 * fill and roof kinds and one roof colour. Regular houses use the row unchanged. Deterministic in
 * the seed. */
// Exact arithmetic: one kind per calm house.
export function houseStyleFor(space: CellSpace, style: HouseStyle, seed: number): HouseStyle {
	const scale = houseScale(space);
	if (scale === 'regular') return style;
	const random = Random.create({ seed }).derive('calm');
	if (scale === 'large')
		return {
			...style,
			fill: { ...style.fill, kinds: style.large.fill },
			roof: { ...style.roof, kinds: style.large.roof },
			slots: { ...style.slots, roof: draw(random, 'roof-slot', style.slots.roof, 1) }
		};
	const colours = Math.ceil(space.cells.length / cellsPerColour);
	const fill = style.fill.kinds.includes('envelope')
		? style.fill.kinds
		: draw(random, 'fill', style.fill.kinds, 1);
	return {
		...style,
		fill: { ...style.fill, kinds: fill },
		roof: { ...style.roof, kinds: draw(random, 'roof', style.roof.kinds, 1) },
		opening: { ...style.opening, kinds: draw(random, 'opening', style.opening.kinds, 1) },
		slots: {
			body: draw(random, 'body', style.slots.body, colours),
			roof: draw(random, 'roof-slot', style.slots.roof, 1),
			capsule: draw(random, 'capsule', style.slots.capsule, colours)
		}
	};
}
