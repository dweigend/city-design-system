import { bounds } from '../../lib/core/object';
import { createCellSpace } from '../../lib/domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseFaces,
	houseFigures,
	houseStyles,
	type HouseStyleName
} from '../../lib/domain/house-court';
import type { DisplayLevel } from '../../lib/scene/focus';
import {
	blockTriangleBudget,
	houseDetailOf,
	houseMaterials,
	houseSheetGapM,
	projectCladHouse
} from '../../lib/scene/house-projection';
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
	const detail = houseDetailOf(setup.level);
	const object = createHouseObject(space, house, detail, style);
	return { space, house, object, faces: houseFaces(space, house, detail, style) };
}

/** Draws one built house as a model in its row's materials (MAT-3). */
function draw(
	{ object, faces }: ReturnType<typeof build>,
	setup: HouseSetup,
	placement?: Readonly<{ translation: readonly [number, number, number]; radians: number }>
) {
	return projectCladHouse(object, faces, houseMaterials[setup.style], setup.level, {
		budget: blockTriangleBudget,
		seed: setup.seed,
		level: 'near',
		...(placement ? { placement } : {})
	}).drawables;
}

/** One house with its figures. */
export function single(setup: HouseSetup) {
	const built = build(setup);
	return { drawables: draw(built, setup), figures: houseFigures(built.space, built.house) };
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
		const drawables = built.flatMap((house, c) => {
			const { min, max } = bounds(house.object);
			const translation = [x - min[0], -y - max[1], 0] as const;
			x += max[0] - min[0] + houseSheetGapM;
			return draw(house, row[c], { translation, radians: 0 }).map((d) => ({
				...d,
				id: `${r}/${c}/${d.id}`
			}));
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
