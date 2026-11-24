import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { move, type PlaceableObject } from '../../lib/core/object';
import type { CityColumn } from '../../lib/domain/city-volume';
import { houseFigures, houseStyles, type HouseStyleName } from '../../lib/domain/house-court';
import type { ParcelBlock } from '../../lib/domain/parcels';
import { projectCityDistricts, projectCityTerrain } from '../../lib/scene/city-volume-projection';
import { houseDetailOf, houseLevels, projectHouse } from '../../lib/scene/house-projection';
import { cityWindow } from '../../lib/world/city-site';
import {
	createParcelHouse,
	createParcelHouseObject,
	createTownHouseStudy,
	type TownHouseBlock
} from '../../lib/world/house-site';
import type { HouseSetup } from './sheets';

/** What the Town view shows: one of the study blocks, or all three together. */
export type TownScope = TownHouseBlock | 'town';

/** Style per block: the selected one everywhere, or one style each in menu order. */
export type TownStyles = 'one' | 'mixed';

const townBlocks: readonly TownHouseBlock[] = ['block', 'neighbour', 'merged'];

function paleStock(
	columns: readonly CityColumn[],
	datumZ: number,
	terrain: ReturnType<typeof projectCityTerrain>
) {
	const { surfaces, fillAlpha } = houseLevels.transparent;
	const ids = new Set(columns.map(({ planCellId }) => planCellId));
	const selection = columns.map((column) => ({
		...column,
		neighbors: column.neighbors.map((id) => (id !== null && ids.has(id) ? id : null))
	}));
	return projectCityDistricts(selection, datumZ, terrain).drawables.flatMap((part) =>
		part.role.startsWith('block') ? [{ ...part, ...surfaces.mass, fillAlpha, occlude: true }] : []
	);
}

/** Prepares the fixed town stage on a valley of the given relief, before drawing styled houses. */
export function townStage(relief?: number) {
	const plan = createTownHouseStudy(relief === undefined ? {} : { relief });
	const { site, layout, holdings, columns, parcelsByBlock, blocks } = plan;
	const terrain = projectCityTerrain(site, layout.grid, layout.plan);
	const bearing = -cityWindow(site, layout.plan).bearing;
	const origin = [...terrain.toLocal(0, 0), 0] as const;
	const local = (object: PlaceableObject) => move(object, origin, bearing);
	const toLocal = ([x, y, z]: Vec3): Vec3 => [...terrain.toLocal(x, y), z];

	function context(chosen: readonly ParcelBlock[]) {
		const members = new Set(chosen.flatMap(({ memberCellIds }) => memberCellIds));
		const neighbors = new Set(
			[...members]
				.flatMap((id) => required(columns.get(id), 'town block column').neighbors)
				.filter((id): id is string => id !== null && !members.has(id))
		);
		const surroundings = holdings.blocks.filter(
			(record) => chosen.includes(record) || record.memberCellIds.some((id) => neighbors.has(id))
		);
		const publicCells = new Set(
			surroundings
				.filter(({ plannedKind }) => plannedKind === 'square')
				.flatMap(({ memberCellIds }) => memberCellIds)
		);
		const stock = [...neighbors]
			.filter((id) => !publicCells.has(id))
			.map((id) => required(columns.get(id), 'neighboring town column'));
		const laneIds = new Set(surroundings.flatMap(({ laneIds }) => laneIds));
		const ground = terrain.projectParcels({
			...holdings,
			blocks: surroundings,
			parcels: chosen.flatMap(({ id }) => parcelsByBlock.get(id) ?? []),
			lanes: holdings.lanes.filter(({ id }) => laneIds.has(id))
		});
		return {
			chosen,
			drawables: [...terrain.drawables, ...ground, ...paleStock(stock, layout.datumZ, terrain)]
		};
	}

	const pick = (scope: TownScope) =>
		scope === 'town' ? townBlocks.map((kind) => blocks[kind]) : [blocks[scope]];
	const contexts = new Map<TownScope, ReturnType<typeof context>>();
	return {
		...plan,
		local,
		toLocal,
		context: (scope: TownScope) => {
			const cached = contexts.get(scope) ?? context(pick(scope));
			contexts.set(scope, cached);
			return cached;
		}
	};
}

function styleOf(setup: HouseSetup, styles: TownStyles, index: number): HouseStyleName {
	if (styles === 'one') return setup.style;
	const names = Object.keys(houseStyles).filter(
		(name): name is HouseStyleName => name !== 'neutral'
	);
	return names[(names.indexOf(setup.style) + index + names.length) % names.length] ?? setup.style;
}

/** Places one house per parcel of the chosen blocks, one style per block, alongside the lanes and
 * pale stock. */
export function townSheet(
	town: ReturnType<typeof townStage>,
	scope: TownScope,
	setup: HouseSetup,
	styles: TownStyles = 'one'
) {
	const { layout, holdings, portals, columns, parcelsByBlock, groundAt, local, toLocal } = town;
	const { chosen, drawables } = town.context(scope);
	const placed = chosen.flatMap((block, index) =>
		(parcelsByBlock.get(block.id) ?? []).map((parcel) =>
			createParcelHouse(
				{
					parcel,
					portal: required(portals.get(parcel.portalId), 'house frontage'),
					block,
					columns,
					datumZ: layout.datumZ,
					linearToleranceM: holdings.linearToleranceM,
					groundAt
				},
				setup,
				houseStyles[styleOf(setup, styles, index)]
			)
		)
	);
	const detail = houseDetailOf(setup.level);
	const houses = placed.flatMap((house) =>
		projectHouse(local(createParcelHouseObject(house, detail)), setup.level)
	);
	const figures = placed
		.map(({ space, house }) => houseFigures(space, house))
		.reduce((sum, house) => ({
			builtCells: sum.builtCells + house.builtCells,
			voidCells: sum.voidCells + house.voidCells,
			floorAreaM2: sum.floorAreaM2 + house.floorAreaM2,
			courtAreaM2: sum.courtAreaM2 + house.courtAreaM2,
			storeys: Math.max(sum.storeys, house.storeys),
			cells: sum.cells + house.cells
		}));
	const low = Math.min(...placed.map(({ groundZ }) => groundZ));
	const top = Math.max(
		...placed.map(({ space, house }) => space.baseZ + house.storeys * space.storeyHeightM)
	);
	const points = chosen.flatMap((block) =>
		block.outline.flatMap(([x, y]) => [toLocal([x, y, low]), toLocal([x, y, top])])
	);
	return { drawables: [...drawables, ...houses], figures, points, count: placed.length };
}
