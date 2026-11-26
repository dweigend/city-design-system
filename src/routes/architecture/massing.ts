import { PlaceableObject } from '../../lib/core/object';
import { createCellSpace, readStoreyElevation } from '../../lib/domain/cell-space';
import {
	createHouseCourt,
	createHouseObject,
	houseStyles,
	type HouseStyleName
} from '../../lib/domain/house-court';
import {
	createMassing,
	createMassingParts,
	createPorousMassing,
	createSetbackMassing
} from '../../lib/domain/massing';
import { projectHouse } from '../../lib/scene/house-projection';
import { parcelShapes, type ParcelShape } from './parcels';

export const massingVariants = [
	{ value: 'baseline', label: 'Baseline', setback: false, porosity: false },
	{ value: 'setback', label: 'Setback', setback: true, porosity: false },
	{ value: 'porosity', label: 'Porosity', setback: false, porosity: true },
	{ value: 'combined', label: 'Setback + Porosity', setback: true, porosity: true }
] as const;

export type MassingVariant = (typeof massingVariants)[number];

export function massingSpecimen(shape: ParcelShape, style: HouseStyleName, seed: number) {
	const styleRow = houseStyles[style];
	const space = createCellSpace(parcelShapes[shape].parcel);
	const house = createHouseCourt(space, { height: 24.5, width: 32, complexity: 0, seed }, styleRow);
	const ground = createHouseObject(space, house, 'block', styleRow);
	const baseline = createMassing(house);
	const setback = createSetbackMassing(space, baseline, { startStorey: 3, depth: 1 });
	const z = readStoreyElevation(space, house.storeys);
	return {
		space,
		seed,
		style,
		ground,
		baseline,
		setback,
		points: space.cells.flatMap(({ quad }) =>
			quad.flatMap(([x, y]) => [[x, y, space.baseZ] as const, [x, y, z] as const])
		)
	};
}

export function massingSheet(
	specimen: ReturnType<typeof massingSpecimen>,
	variant: MassingVariant
) {
	const { space, ground, baseline, setback, seed } = specimen;
	const source = variant.setback ? setback : baseline;
	const cut = variant.porosity
		? createPorousMassing(space, source, { ratio: 0.25, seed })
		: undefined;
	const finalMassing = cut?.massing ?? source;
	const parts = createMassingParts(space, finalMassing);
	let terraces = 0;
	let passThroughs = 0;
	if (cut) {
		const highestByCell = new Map<string, number>();
		for (const run of finalMassing.runs)
			highestByCell.set(run.id, Math.max(highestByCell.get(run.id) ?? -Infinity, run.toStorey));
		for (const { cellId, storey } of cut.voids) {
			if ((highestByCell.get(cellId) ?? -Infinity) > storey) passThroughs++;
			else terraces++;
		}
	}
	const object = PlaceableObject.create({
		id: ground.id,
		footprint: ground.footprint,
		anchors: ground.anchors,
		slots: ground.slots,
		parts: [...ground.parts.filter(({ slot }) => slot !== 'mass'), ...parts]
	});
	return {
		drawables: projectHouse(object, 'full'),
		measurements: [
			{ label: 'Occupied storey cells', value: String(parts.length), unit: '' },
			{ label: 'Terraces', value: String(terraces), unit: '' },
			{ label: 'Pass-through voids', value: String(passThroughs), unit: '' }
		]
	};
}
