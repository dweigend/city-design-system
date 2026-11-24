import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { move, type PlaceableObject } from '../../lib/core/object';
import type { CityColumn } from '../../lib/domain/city-volume';
import {
	houseFaces,
	houseFigures,
	houseStyles,
	readHouseFeatures,
	type HouseStyleName
} from '../../lib/domain/house-court';
import type { ParcelBlock } from '../../lib/domain/parcels';
import { projectCityDistricts, projectCityTerrain } from '../../lib/scene/city-volume-projection';
import {
	blockTriangleBudget,
	faceAreaM2,
	houseDetailOf,
	houseLevels,
	houseMaterials,
	projectCladHouse,
	readHouseSalience
} from '../../lib/scene/house-projection';
import { cityWindow } from '../../lib/world/city-site';
import {
	createTownBlockHouses,
	createParcelHouseObject,
	createTownHouseStudy,
	type TownHouseBlock
} from '../../lib/world/house-site';
import type { SurfaceLevel } from '../../lib/scene/material';
import type { HouseSetup } from './sheets';

/** What the Town view shows: one of the study blocks, all three together, or every block of the
 * town. */
export type TownScope = TownHouseBlock | 'town' | 'all';

/** How the Town view grants detail: by the salience rule, or every house plain (MAT-15). */
export type TownDetail = 'salient' | 'plain';

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
	const placement = { translation: origin, radians: bearing };
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

	const built = () =>
		plan.holdings.blocks.filter(({ id }) =>
			plan.parcelsByBlock.get(id)?.some(({ publicUse }) => !publicUse)
		);
	const pick = (scope: TownScope) =>
		scope === 'all'
			? built()
			: scope === 'town'
				? townBlocks.map((kind) => blocks[kind])
				: [blocks[scope]];
	const contexts = new Map<TownScope, ReturnType<typeof context>>();
	return {
		...plan,
		local,
		placement,
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
 * pale stock. Every house is a plain volume; with `salient` detail the salience rule grants detail
 * to the houses that carry the picture (MAT-15). Each block shares the cladding budget by face
 * area. */
export function townSheet(
	town: ReturnType<typeof townStage>,
	scope: TownScope,
	setup: HouseSetup,
	styles: TownStyles = 'one',
	grant: TownDetail = 'salient'
) {
	const { groundAt, placement, toLocal } = town;
	const { chosen, drawables } = town.context(scope);
	const detail = houseDetailOf(setup.level);
	const results = chosen.map((block, index) => {
		const style = styleOf(setup, styles, index);
		return { style, ...createTownBlockHouses(town, block, setup, houseStyles[style]) };
	});
	const unbuildable = results.flatMap(({ unbuildable }) => unbuildable);
	const levels =
		grant === 'plain'
			? new Map<string, SurfaceLevel>()
			: readHouseSalience(
					results.flatMap(({ placed }, index) =>
						placed.map(({ space, house }) => ({
							id: space.id,
							block: chosen[index].id,
							features: readHouseFeatures(space, house)
						}))
					),
					setup.seed
				);
	// A plain house needs only its masses: build the block detail and no faces (MAT-15).
	const detailOf = (id: string) =>
		levels.has(id) && levels.get(id) !== 'plain' ? detail : 'block';
	const placed = results.flatMap(({ style, placed }) => {
		const houses = placed.map((house) => {
			const own = detailOf(house.space.id);
			const faces =
				own === 'block'
					? []
					: houseFaces(house.space, house.house, own, house.style, house.adjoiningWalls);
			return { ...house, own, faces, area: faces.reduce((sum, face) => sum + faceAreaM2(face), 0) };
		});
		const area = houses.reduce((sum, house) => sum + house.area, 0);
		return houses.map((house) => ({
			...house,
			materials: houseMaterials[style],
			budget: area > 0 ? (blockTriangleBudget * house.area) / area : 0
		}));
	});
	const projected = placed.map((house) =>
		projectCladHouse(
			createParcelHouseObject(house, house.own, house.adjoiningWalls),
			house.faces,
			house.materials,
			setup.level,
			{
				budget: house.budget,
				placement,
				seed: setup.seed,
				level: levels.get(house.space.id) ?? 'plain'
			}
		)
	);
	const houses = projected.flatMap(({ drawables }) => drawables);
	const triangles = projected.reduce((sum, { triangles }) => sum + triangles, 0);
	const figures = placed
		.map(({ space, house }) => houseFigures(space, house))
		.reduce(
			(sum, house) => ({
				builtCells: sum.builtCells + house.builtCells,
				voidCells: sum.voidCells + house.voidCells,
				floorAreaM2: sum.floorAreaM2 + house.floorAreaM2,
				courtAreaM2: sum.courtAreaM2 + house.courtAreaM2,
				storeys: Math.max(sum.storeys, house.storeys),
				cells: sum.cells + house.cells
			}),
			{ builtCells: 0, voidCells: 0, floorAreaM2: 0, courtAreaM2: 0, storeys: 0, cells: 0 }
		);
	const ground = chosen.flatMap((block) => block.outline.map(groundAt));
	const low = Math.min(...ground, ...placed.map(({ groundZ }) => groundZ));
	const top = Math.max(
		...ground,
		...placed.map(({ space, house }) => space.baseZ + house.storeys * space.storeyHeightM)
	);
	const points = chosen.flatMap((block) =>
		block.outline.flatMap(([x, y]) => [toLocal([x, y, low]), toLocal([x, y, top])])
	);
	return {
		drawables: [...drawables, ...houses],
		figures,
		points,
		count: placed.length,
		triangles,
		unbuildable
	};
}
