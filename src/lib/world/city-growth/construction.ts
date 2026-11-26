import { required } from '../../core/invariant';
import { createCellSpaceStoreys, type CellSpace } from '../../domain/cell-space';
import {
	createMassing,
	createMassingParts,
	createPorousMassing,
	createSetbackMassing,
	type HouseCell,
	type HouseOccupancy
} from '../../domain/massing';
import { createDatedPrism, type Construction, type StoreyPlanes } from './building';
import type { Burgage } from './burgage';
import type { CityGrowthPart } from './types';

function readBurgageDatum({ frontId, rearId, groundByCell }: Burgage, planes: StoreyPlanes) {
	const front = required(groundByCell.get(frontId), 'front wing ground');
	const rear = required(groundByCell.get(rearId), 'rear wing ground');
	return planes.indexAtOrAbove(Math.max(front.highest, rear.highest));
}

// Each run describes only construction in this event. Retained storeys stay outside both cutters.
function createNewOccupancy(
	space: CellSpace,
	burgage: Burgage,
	useByCell: ReadonlyMap<string, CityGrowthPart['use']>,
	construction: Construction
): HouseOccupancy {
	const { cells, storeyCount } = space;
	const { cellIds } = burgage.courtAccess;
	const access = new Set(cellIds);
	const courtId = cellIds.at(-1);
	const firstStorey = /* Exact arithmetic: a construction window starts at local storey zero. */ 0;
	const height = space.storeyElevationsM[storeyCount] - space.baseZ;
	return {
		spaceId: space.id,
		cellIds: cells.map(({ id }) => id),
		styleId: construction.era.styleId,
		inputs: {
			height,
			width: /* Exact arithmetic: footprint is specified directly by cell IDs. */ 0,
			complexity: /* Exact arithmetic: no occupancy style variation for fixed runs. */ 0,
			seed: construction.seed
		},
		storeys: storeyCount,
		cells: cells.map(({ id }): HouseCell => {
			if (useByCell.has(id))
				return { id, role: 'wing', fromStorey: firstStorey, toStorey: storeyCount };
			let role: HouseCell['role'] = 'garden';
			if (id === courtId) role = 'court';
			else if (access.has(id)) role = 'passage';
			return { id, role, fromStorey: firstStorey, toStorey: firstStorey };
		}),
		entrances: [cellIds],
		scale: 'regular',
		courtAccess: true,
		site: {
			entranceRiseM: /* Exact arithmetic: massing does not model entrance stairs. */ 0,
			corner: false,
			groundZ: null
		}
	};
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
	const space = createCellSpaceStoreys(burgage.space, {
		baseZ: elevations[0],
		datumIndex,
		storeyCount,
		storeyElevationsM: elevations,
		storeyHeightsM: elevations.slice(1).map((top, i) => top - elevations[i])
	});
	const base = createNewOccupancy(space, burgage, useByCell, construction);
	const massing = createMassing(base);
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
