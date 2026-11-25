import type { Vec3 } from '../../lib/core/geometry';
import { required } from '../../lib/core/invariant';
import { move, type PlaceableObject } from '../../lib/core/object';
import { readStoreyElevation } from '../../lib/domain/cell-space';
import type { CityColumn } from '../../lib/domain/city-volume';
import {
	houseFaces,
	houseFigures,
	houseStyles,
	readHouseFeatures,
	type AdjoiningWall,
	type HouseDetail,
	type HouseStyleName
} from '../../lib/domain/house-court';
import type { ParcelBlock } from '../../lib/domain/parcels';
import { projectCityDistricts, projectCityTerrain } from '../../lib/scene/city-volume-projection';
import {
	blockTriangleBudget,
	faceAreaM2,
	readHouseDetail,
	houseLevels,
	houseMaterials,
	projectCladHouse,
	projectProgrammedHouse,
	readHouseSalience
} from '../../lib/scene/house-projection';
import { cityWindow, riverCityRecipe } from '../../lib/world/city-site';
import {
	createParcelHouseObject,
	createTownHouseStudy,
	placeTownBlockHouses,
	readParcelHouseWalls,
	type PlacedParcelHouse,
	type ParcelHouseRecipe,
	type TownHouseBlock
} from '../../lib/world/house-site';
import type { SurfaceLevel } from '../../lib/domain/material';
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
	terrain: ReturnType<typeof projectCityTerrain>,
	levelHeightM: number
) {
	const { surfaces, fillAlpha } = houseLevels.transparent;
	const ids = new Set(columns.map(({ planCellId }) => planCellId));
	const selection = columns.map((column) => ({
		...column,
		neighbors: column.neighbors.map((id) => (id !== null && ids.has(id) ? id : null))
	}));
	return projectCityDistricts(
		selection,
		datumZ,
		terrain,
		undefined,
		undefined,
		undefined,
		levelHeightM
	).drawables.flatMap((part) =>
		part.role.startsWith('block') ? [{ ...part, ...surfaces.mass, fillAlpha, occlude: true }] : []
	);
}

/** Prepares the fixed town stage on a valley of the given relief, before drawing styled houses. */
export function townStage(
	relief?: number,
	readHouseRecipe?: (vertical: typeof riverCityRecipe) => ParcelHouseRecipe
) {
	const plan = createTownHouseStudy(relief === undefined ? {} : { relief });
	const { site, layout, holdings, columns, parcelsByBlock, blocks } = plan;
	const houseRecipe = readHouseRecipe?.(site.recipe ?? riverCityRecipe);
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
			drawables: [
				...terrain.drawables,
				...ground,
				...paleStock(stock, layout.datumZ, terrain, (site.recipe ?? riverCityRecipe).levelHeightM)
			]
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
		readParcelSite: (id: string) => {
			const site = plan.readParcelSite(id);
			return site && houseRecipe ? { ...site, recipe: { ...site.recipe, ...houseRecipe } } : site;
		},
		terrain,
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
	const names = Object.keys(houseStyles) as HouseStyleName[];
	return names[(names.indexOf(setup.style) + index + names.length) % names.length] ?? setup.style;
}

/** Plans occupancy and framing once. House projections can then be built plain or in salience
 * order without placing the parcels again. */
export function prepareTownSheet(
	town: ReturnType<typeof townStage>,
	scope: TownScope,
	setup: HouseSetup,
	styles: TownStyles
) {
	const { groundAt, placement, toLocal } = town;
	const { chosen, drawables } = town.context(scope);
	const detail = readHouseDetail(setup.level);
	const results = chosen.map((block, index) => {
		const style = styleOf(setup, styles, index);
		return { block, style, ...placeTownBlockHouses(town, block, setup, houseStyles[style]) };
	});
	const placed = results.flatMap(({ placed }) => placed);

	function project(
		house: PlacedParcelHouse,
		style: HouseStyleName,
		own: HouseDetail,
		level: SurfaceLevel,
		adjoiningWalls: readonly AdjoiningWall[],
		faces: ReturnType<typeof houseFaces>,
		budget: number
	) {
		const options = { budget, placement, seed: setup.seed, level };
		if (house.house.cells.some(({ program }) => program?.length))
			return projectProgrammedHouse(
				house,
				own,
				adjoiningWalls,
				faces,
				houseMaterials[style],
				setup.level,
				options
			);
		return projectCladHouse(
			createParcelHouseObject(house, own, adjoiningWalls),
			faces,
			houseMaterials[style],
			setup.level,
			options
		);
	}

	const houses = results.flatMap(({ style, placed }) =>
		placed.map((house) => ({
			id: house.space.id,
			build: () => project(house, style, 'block', 'plain', [], [], 0)
		}))
	);

	function readDetails(cap?: number) {
		const levels = readHouseSalience(
			results.flatMap(({ block, placed }) =>
				placed.map(({ space, house }) => ({
					id: space.id,
					block: block.id,
					features: readHouseFeatures(space, house)
				}))
			),
			setup.seed,
			cap
		);
		return results.flatMap(({ style, placed }) => {
			const salient = placed.filter(({ space }) => levels.get(space.id) !== 'plain');
			function readFaces() {
				const walls = detail === 'block' ? [] : placed.map(readParcelHouseWalls);
				return salient.map((house) => {
					const adjoining = walls.flatMap((group, i) => (placed[i] === house ? [] : group));
					const faces =
						detail === 'block'
							? []
							: houseFaces(house.space, house.house, detail, house.style, adjoining);
					const area = faces.reduce((sum, face) => sum + faceAreaM2(face), 0);
					return { adjoining, faces, area };
				});
			}
			let blockFaces: ReturnType<typeof readFaces> | undefined;
			let area = 0;
			return salient.map((house, index) => ({
				id: house.space.id,
				build: () => {
					if (!blockFaces) {
						blockFaces = readFaces();
						area = blockFaces.reduce((sum, house) => sum + house.area, 0);
					}
					const { adjoining, faces, area: ownArea } = blockFaces[index];
					const budget = area > 0 ? (blockTriangleBudget * ownArea) / area : 0;
					const level = levels.get(house.space.id) ?? 'plain';
					return project(house, style, detail, level, adjoining, faces, budget);
				}
			}));
		});
	}

	const ground = chosen.flatMap((block) => block.outline.map(groundAt));
	const low = Math.min(...ground, ...placed.map(({ groundZ }) => groundZ));
	const top = Math.max(
		...ground,
		...placed.map(({ space, house }) => readStoreyElevation(space, house.storeys))
	);
	const points = chosen.flatMap((block) =>
		block.outline.flatMap(([x, y]) => [toLocal([x, y, low]), toLocal([x, y, top])])
	);
	return {
		drawables,
		placed,
		houses,
		points,
		readDetails,
		unbuildable: results.flatMap(({ unbuildable }) => unbuildable)
	};
}

/** Draws the Architecture town sheet synchronously, sharing the same occupancy and salience
 * rules as the progressive town review. */
export function townSheet(
	town: ReturnType<typeof townStage>,
	scope: TownScope,
	setup: HouseSetup,
	styles: TownStyles = 'one',
	grant: TownDetail = 'salient'
) {
	const { drawables, placed, houses, points, readDetails, unbuildable } = prepareTownSheet(
		town,
		scope,
		setup,
		styles
	);
	const details = new Map(
		(grant === 'plain' ? [] : readDetails()).map(({ id, build }) => [id, build])
	);
	const projected = houses.map(({ id, build }) => (details.get(id) ?? build)());
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
	return {
		drawables: [...drawables, ...projected.flatMap(({ drawables }) => drawables)],
		figures,
		points,
		count: placed.length,
		triangles,
		unbuildable
	};
}
