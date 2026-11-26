import { PlaceableObject } from '../../lib/core/object';
import { createCellSpace, readStoreyElevation } from '../../lib/domain/cell-space';
import { createHouseCourt, createHouseObject } from '../../lib/domain/house-court';
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

export function massingSpecimen(shape: ParcelShape, seed: number) {
	const space = createCellSpace(parcelShapes[shape].parcel);
	const house = createHouseCourt(space, { height: 24.5, width: 32, complexity: 0, seed });
	const ground = createHouseObject(space, house, 'block');
	const baseline = createMassing(house);
	const setback = createSetbackMassing(space, baseline, { startStorey: 3, depth: 1 });
	const z = readStoreyElevation(space, house.storeys);
	return {
		space,
		seed,
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
	const parts = createMassingParts(space, cut?.massing ?? source);
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
			{
				label: 'Terraces',
				value: String(cut?.voids.filter(({ kind }) => kind === 'terrace').length ?? 0),
				unit: ''
			},
			{
				label: 'Pass-through voids',
				value: String(cut?.voids.filter(({ kind }) => kind === 'pass-through').length ?? 0),
				unit: ''
			}
		]
	};
}
