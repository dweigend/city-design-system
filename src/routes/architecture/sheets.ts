import { bounds, move } from '../../lib/core/object';
import { createCellSpace } from '../../lib/domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseFigures,
	houseStyles,
	type HouseStyleName
} from '../../lib/domain/house-court';
import type { DisplayLevel } from '../../lib/scene/focus';
import { houseDetailOf, houseSheetGapM, projectHouse } from '../../lib/scene/house-projection';
import type { Drawable } from '../../lib/scene/surface';
import { parcelShapes, type ParcelShape } from './parcels';

/** One house of the chapter: parcel shape, style, block inputs, seed and display level. */
export type HouseSetup = Readonly<{
	shape: ParcelShape;
	style: HouseStyleName;
	height: number;
	width: number;
	complexity: number;
	seed: number;
	level: DisplayLevel;
}>;

/** The styles in menu order, neutral first. */
export const styleNames = Object.keys(houseStyles) as HouseStyleName[];
const builtStyles = styleNames.filter((name) => name !== 'neutral');

function build(setup: HouseSetup) {
	const style = houseStyles[setup.style];
	const space = createCellSpace(parcelShapes[setup.shape].parcel);
	const house = createHouseCourt(space, setup, style);
	const object = createHouseObject(space, house, houseDetailOf(setup.level), style);
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
		const built = row.map((setup) => build(setup).object);
		const depth = Math.max(...built.map((object) => bounds(object).max[1] - bounds(object).min[1]));
		const drawables = built.flatMap((object, c) => {
			const { min, max } = bounds(object);
			const placed = move(object, [x - min[0], -y - max[1], 0], 0);
			x += max[0] - min[0] + houseSheetGapM;
			return projectHouse(placed, row[c].level).map((d) => ({ ...d, id: `${r}/${c}/${d.id}` }));
		});
		y += depth + houseSheetGapM;
		return drawables;
	});
}

/** The comparison sheets of the chapter, by name. */
export const sheets = {
	shapes: (setup: HouseSetup) =>
		lay([Object.keys(parcelShapes).map((shape) => ({ ...setup, shape: shape as ParcelShape }))]),
	levels: (setup: HouseSetup) =>
		lay([(['full', 'silhouette', 'pencil'] as const).map((level) => ({ ...setup, level }))]),
	inputs: (setup: HouseSetup) =>
		lay(
			[10.5, 17.5, 28].map((height) =>
				[0, 0.5, 1].map((complexity) => ({ ...setup, height, complexity }))
			)
		),
	styles: (setup: HouseSetup) => lay([styleNames.map((style) => ({ ...setup, style }))]),
	'style-shapes': (setup: HouseSetup) =>
		lay(
			builtStyles.map((style) =>
				Object.keys(parcelShapes).map((shape) => ({ ...setup, style, shape: shape as ParcelShape }))
			)
		),
	'style-levels': (setup: HouseSetup) =>
		lay(
			builtStyles.map((style) =>
				(['full', 'silhouette', 'pencil'] as const).map((level) => ({ ...setup, style, level }))
			)
		),
	'style-inputs': (setup: HouseSetup) =>
		lay(
			builtStyles.map((style) =>
				[
					[10.5, 0.2],
					[10.5, 1],
					[28, 0.2],
					[28, 1]
				].map(([height, complexity]) => ({ ...setup, style, height, complexity }))
			)
		)
} as const;

/** Sheet names. */
export type SheetName = keyof typeof sheets;
