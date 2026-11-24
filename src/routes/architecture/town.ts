import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { move, type PlaceableObject } from '../../lib/core/object';
import type { CityColumn } from '../../lib/domain/city-volume';
import { houseFigures, houseStyles } from '../../lib/domain/house-court';
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

/** Prepares the fixed town stage and its nearby lanes before drawing a styled house. */
export function townStage() {
	const plan = createTownHouseStudy();
	const { site, layout, holdings, columns, parcelsByBlock, blocks } = plan;
	const terrain = projectCityTerrain(site, layout.grid, layout.plan);
	const bearing = -cityWindow(site, layout.plan).bearing;
	const origin = [...terrain.toLocal(0, 0), 0] as const;
	const local = (object: PlaceableObject) => move(object, origin, bearing);
	const toLocal = ([x, y, z]: Vec3): Vec3 => [...terrain.toLocal(x, y), z];

	function context(kind: TownHouseBlock) {
		const block = blocks[kind];
		const members = new Set(block.memberCellIds);
		const neighbors = new Set(
			block.memberCellIds
				.flatMap((id) => required(columns.get(id), 'town block column').neighbors)
				.filter((id): id is string => id !== null && !members.has(id))
		);
		const surroundings = holdings.blocks.filter(
			(record) => record.id === block.id || record.memberCellIds.some((id) => neighbors.has(id))
		);
		const publicCells = new Set(
			surroundings
				.filter(({ plannedKind }) => plannedKind === 'square')
				.flatMap(({ memberCellIds }) => memberCellIds)
		);
		const stock = [...neighbors]
			.filter((id) => !publicCells.has(id))
			.map((id) => required(columns.get(id), 'neighboring town column'));
		const parcels = parcelsByBlock.get(block.id) ?? [];
		const laneIds = new Set(surroundings.flatMap(({ laneIds }) => laneIds));
		const ground = terrain.projectParcels({
			...holdings,
			blocks: surroundings,
			parcels,
			lanes: holdings.lanes.filter(({ id }) => laneIds.has(id))
		});
		return {
			block,
			parcels,
			drawables: [...terrain.drawables, ...ground, ...paleStock(stock, layout.datumZ, terrain)]
		};
	}

	return {
		...plan,
		local,
		toLocal,
		contexts: { block: context('block'), merged: context('merged') }
	};
}

/** Places one house per selected parcel using one style, alongside the existing lane and stock drawing. */
export function townSheet(
	town: ReturnType<typeof townStage>,
	kind: TownHouseBlock,
	setup: HouseSetup
) {
	const { layout, holdings, portals, columns, local, toLocal } = town;
	const { block, parcels, drawables } = town.contexts[kind];
	const placed = parcels.map((parcel) =>
		createParcelHouse(
			{
				parcel,
				portal: required(portals.get(parcel.portalId), 'house frontage'),
				block,
				columns,
				datumZ: layout.datumZ,
				linearToleranceM: holdings.linearToleranceM
			},
			setup,
			houseStyles[setup.style]
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
	const points = block.outline.flatMap(([x, y]) => [toLocal([x, y, low]), toLocal([x, y, top])]);
	return { drawables: [...drawables, ...houses], figures, points, count: placed.length };
}
