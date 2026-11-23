import { bounds, move } from '../../lib/core/object';
import { createCellSpace } from '../../lib/domain/cell-space';
import { createHouseCourt, createHouseObject, houseFigures } from '../../lib/domain/house-court';
import type { DisplayLevel } from '../../lib/scene/focus';
import { houseDetailOf, projectHouse } from '../../lib/scene/house-projection';
import type { Drawable } from '../../lib/scene/surface';
import { parcelShapes, type ParcelShape } from './parcels';

/** One house of the chapter: parcel shape, block inputs, seed and display level. */
export type HouseSetup = Readonly<{
	shape: ParcelShape;
	height: number;
	width: number;
	complexity: number;
	seed: number;
	level: DisplayLevel;
}>;

const gapM = 8;

function build(setup: HouseSetup) {
	const space = createCellSpace(parcelShapes[setup.shape].parcel);
	const house = createHouseCourt(space, setup);
	const object = createHouseObject(space, house, houseDetailOf(setup.level));
	return { space, house, object };
}

/** One house with its figures. */
export function single(setup: HouseSetup) {
	const { space, house, object } = build(setup);
	return { drawables: projectHouse(object, setup.level), figures: houseFigures(space, house) };
}

/** Lays houses left to right, then rows front to back, each drawable id prefixed by its slot. */
function lay(rows: readonly (readonly HouseSetup[])[]): Drawable[] {
	let y = 0;
	return rows.flatMap((row, r) => {
		let x = 0;
		const built = row.map((setup) => build(setup));
		const depth = Math.max(
			...built.map(({ object }) => bounds(object).max[1] - bounds(object).min[1])
		);
		const drawables = built.flatMap(({ object }, c) => {
			const { min, max } = bounds(object);
			const placed = move(object, [x - min[0], -y - max[1], 0], 0);
			x += max[0] - min[0] + gapM;
			return projectHouse(placed, row[c].level).map((d) => ({ ...d, id: `${r}/${c}/${d.id}` }));
		});
		y += depth + gapM;
		return drawables;
	});
}

/** The same inputs on all five parcel shapes. */
export const shapesSheet = (setup: HouseSetup) =>
	lay([Object.keys(parcelShapes).map((shape) => ({ ...setup, shape: shape as ParcelShape }))]);

/** Full, block and pencil drawings of one house side by side. */
export const levelsSheet = (setup: HouseSetup) =>
	lay([(['full', 'silhouette', 'pencil'] as const).map((level) => ({ ...setup, level }))]);

/** A 3 × 3 sheet: height rising front to back, complexity rising left to right. */
export const inputsSheet = (setup: HouseSetup) =>
	lay(
		[10.5, 17.5, 28].map((height) =>
			[0, 0.5, 1].map((complexity) => ({ ...setup, height, complexity }))
		)
	);
