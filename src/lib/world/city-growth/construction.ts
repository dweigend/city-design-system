import { required } from '../../core/invariant';
import { createCellSpaceStoreys, type CellSpace } from '../../domain/cell-space';
import { createHouseCourt, houseStyles } from '../../domain/house-court';
import {
	createMassing,
	createMassingParts,
	createPorousMassing,
	createSetbackMassing,
	type Massing
} from '../../domain/massing';
import { createDatedPrism, type Construction, type StoreyPlanes } from './building';
import type { Burgage } from './burgage';
import type { CityGrowthPart } from './types';

function readBurgageDatum(
	{ placed, frontId, rearId, groundByCell }: Burgage,
	planes: StoreyPlanes
) {
	const front = required(groundByCell.get(frontId), 'front wing ground');
	const rear = required(groundByCell.get(rearId), 'rear wing ground');
	const requiredIndex = planes.indexAtOrAbove(Math.max(front.highest, rear.highest));
	return Math.max(placed.space.datumIndex, requiredIndex);
}

// Each run describes only construction in this event. Retained storeys stay outside both cutters.
function createWindowMassing(
	space: CellSpace,
	burgage: Burgage,
	useByCell: ReadonlyMap<string, CityGrowthPart['use']>,
	construction: Construction
): Massing {
	const { house: placedHouse, style: placedStyle, groundZ } = burgage.placed;
	const eraStyle = houseStyles[construction.era.styleId];
	const windowStyle = {
		...eraStyle,
		occupancy: {
			...eraStyle.occupancy,
			groundOpenRatio: /* Exact arithmetic: dated window slices start at the window floor. */ 0
		},
		large: {
			...eraStyle.large,
			// Reservation-time court topology stays invariant across later construction eras (CITY-15).
			court: placedHouse.scale === 'large' ? placedStyle.large.court : eraStyle.large.court
		}
	};
	const house = createHouseCourt(
		space,
		{
			height: space.storeyElevationsM[space.storeyCount] - space.baseZ,
			width: placedHouse.inputs.width,
			complexity: placedHouse.inputs.complexity,
			seed: construction.seed
		},
		windowStyle,
		{
			scale: placedHouse.scale,
			corner: placedHouse.site.corner,
			groundZ,
			entranceRiseM: placedHouse.site.entranceRiseM
		}
	);
	const baseMassing = createMassing(house);
	const runs = house.cells
		.filter(({ id, fromStorey }) => useByCell.has(id) && fromStorey < space.storeyCount)
		.map((cell) =>
			Object.freeze({
				...cell,
				role: 'wing' as const,
				toStorey: space.storeyCount
			})
		);
	return Object.freeze({ base: baseMassing.base, runs: Object.freeze(runs) });
}

export function createCellConstruction(
	buildingId: string,
	burgage: Burgage,
	planes: StoreyPlanes,
	datumIndex: number,
	storeyCount: number,
	useByCell: ReadonlyMap<string, CityGrowthPart['use']>,
	construction: Construction
): readonly CityGrowthPart[] {
	const elevations = Array.from({ length: storeyCount + 1 }, (_, i) =>
		planes.atIndex(datumIndex + i)
	);
	const space = createCellSpaceStoreys(burgage.placed.space, {
		baseZ: elevations[0],
		datumIndex,
		storeyCount,
		storeyElevationsM: elevations,
		storeyHeightsM: elevations.slice(1).map((top, i) => top - elevations[i])
	});
	const massing = createWindowMassing(space, burgage, useByCell, construction);
	const setback = createSetbackMassing(space, massing, {
		startStorey: /* Exact arithmetic: keep the first new storey before cutting above it. */ 1,
		depth: construction.era.setbackDepth ?? 0
	});
	const porous = createPorousMassing(space, setback, {
		ratio: construction.era.porosityRatio ?? 0
	});
	const volumes = createMassingParts(space, porous.massing);
	let index = 0;
	const parts = porous.massing.runs.flatMap(({ id, fromStorey: from, toStorey: to }) => {
		const use = required(useByCell.get(id), 'new cell use');
		return Array.from({ length: to - from }, (_, offset) => {
			const { shape } = volumes[index++];
			if (shape.kind !== 'prism') throw Error('Expected a massing prism');
			return createDatedPrism(
				buildingId,
				'storey',
				datumIndex + from + offset,
				shape,
				{ ...construction, use },
				id
			);
		});
	});
	return Object.freeze(parts.sort((a, b) => a.datumIndex - b.datumIndex));
}

export function createWing(
	buildingId: string,
	burgage: Burgage,
	cellId: string,
	planes: StoreyPlanes,
	storeys: number,
	construction: Construction
): readonly CityGrowthPart[] {
	const first = readBurgageDatum(burgage, planes);
	const storeyParts = createCellConstruction(
		buildingId,
		burgage,
		planes,
		first,
		storeys,
		new Map([[cellId, construction.use]]),
		construction
	);
	if (!storeyParts.length) return storeyParts;
	const [part] = storeyParts;
	if (part.shape.kind !== 'prism') throw Error('Expected a wing prism');
	const { lowest } = required(burgage.groundByCell.get(cellId), 'wing ground');
	if (part.shape.base <= lowest) return storeyParts;
	const foundation = createDatedPrism(
		buildingId,
		'foundation',
		first,
		{
			...part.shape,
			base: lowest,
			top: part.shape.base
		},
		construction,
		cellId
	);
	return Object.freeze([foundation, ...storeyParts]);
}
