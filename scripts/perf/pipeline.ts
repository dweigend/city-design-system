import { defaults as brush } from '../../src/config/sandbox-brush';
import { resolveParams } from '../../src/lib/core/params';
import type { Vec2 } from '../../src/lib/core/geometry';
import { createCityLattice, readCityColumns } from '../../src/lib/domain/city-volume';
import { houseStyles, readHouseFeatures } from '../../src/lib/domain/house-court';
import { readCityMovement } from '../../src/lib/world/city-movement';
import {
	citySiteParams,
	createCitySite,
	readCityDistricts,
	readCityGrid,
	readCityParcels
} from '../../src/lib/world/city-site';
import { createTownBlockHouses, createTownParcelSites } from '../../src/lib/world/house-site';
import { createSandboxProjection } from '../../src/lib/scene/sandbox-projection';
import { blockTriangleBudget, readHouseSalience } from '../../src/lib/scene/house-projection';
import { shareBlockBudget } from '../../src/lib/scene/sandbox-interaction';
import { createTownSandbox } from '../../src/routes/sandbox/town';
import { protocol } from '../config/perf-baseline';
import { bytesPerMiB, round } from './host';

const brushParams = {
	width: brush.sandboxBrushWidthM,
	height: brush.sandboxBrushHeightM,
	complexity: brush.sandboxBrushComplexity
};
const houseSeed = brush.sandboxSpecimenSeed;

function memory() {
	const { heapUsed, rss } = process.memoryUsage();
	return { heapMiB: round(heapUsed / bytesPerMiB), rssMiB: round(rss / bytesPerMiB) };
}

function measure(largest: boolean) {
	const started = performance.now();
	const stages: Record<string, { ms: number; heapMiB: number; rssMiB: number }> = {};
	function stage<T>(name: string, run: () => T): T {
		const start = performance.now();
		const result = run();
		stages[name] = { ms: round(performance.now() - start), ...memory() };
		return result;
	}

	const sizeM = largest ? citySiteParams.citySize.max : citySiteParams.citySize.default;
	const { seed } = stage('seed', () => resolveParams(citySiteParams, { citySize: sizeM }));
	const variant = 'organic';
	const site = stage('terrain', () => createCitySite(undefined, { seed }));
	const layout = stage('plan', () => readCityGrid(site, sizeM, variant, seed));
	const { holdings, columns } = stage('parcels', () => ({
		holdings: readCityParcels(site, layout),
		columns: readCityColumns(layout.grid, readCityDistricts(site, layout, seed))
	}));
	const byCell = new Map(columns.map((column) => [column.planCellId, column]));
	const parcelsByBlock = Map.groupBy(holdings.parcels, ({ blockId }) => blockId);
	const groundAt = ([x, y]: Vec2) => site.sampleGround(x, y).height;
	const readParcelSite = createTownParcelSites(holdings, byCell, layout.datumZ, groundAt);
	const privateParcels = holdings.parcels.filter(({ publicUse }) => !publicUse);
	const blocks = holdings.blocks.filter(({ id }) =>
		parcelsByBlock.get(id)?.some(({ publicUse }) => !publicUse)
	);
	// Spread the bounded sample across the plan rather than concentrating it near the center.
	const sampleBlocks = protocol.perfLargestSampleBlocks.value;
	const chosen = largest
		? Array.from(
				{ length: sampleBlocks },
				(_, i) => blocks[Math.floor((i * blocks.length) / sampleBlocks)]
			)
		: blocks;
	const houses = stage('houses', () =>
		chosen.flatMap(
			(block) =>
				createTownBlockHouses(
					{ parcelsByBlock, readParcelSite },
					block,
					{ ...brushParams, seed: houseSeed },
					houseStyles.neutral
				).placed
		)
	);
	const movement = stage('movement', () => readCityMovement(site, layout, [], 0, undefined, []));
	const projection = stage('groundDrawables', () =>
		createSandboxProjection(site, layout, holdings)
	);
	const levels = stage('salience', () =>
		readHouseSalience(
			houses.map(({ space, house, parcel }) => ({
				id: space.id,
				block: parcel.blockId,
				features: readHouseFeatures(space, house)
			})),
			seed
		)
	);
	const budgets = shareBlockBudget(
		houses.map(({ space, parcel }) => ({
			id: space.id,
			block: parcel.blockId
		})),
		blockTriangleBudget
	);
	const project = (salient: boolean) =>
		houses.reduce((count, house) => {
			const { id } = house.space;
			return (
				count +
				projection.projectParcelHouse(house, house.adjoiningWalls, id, {
					level: salient ? (levels.get(id) ?? 'plain') : 'plain',
					budget: budgets.get(id) ?? 0,
					tone: 'cream'
				}).length
			);
		}, 0);
	const drawables = {
		background: projection.background.length,
		plain: stage('plain', () => project(false)),
		salient: stage('salient', () => project(true)),
		detailedHouses: [...levels.values()].filter((level) => level !== 'plain').length
	};
	const lattice = stage('lattice', () => createCityLattice(columns, layout.datumZ, variant));

	return {
		sizeM,
		seed,
		variant,
		houseInputs: { ...brushParams, seed: houseSeed, style: houseStyles.neutral.id },
		stages,
		counts: {
			cells: layout.grid.cells.length,
			parcels: holdings.parcels.length,
			privateParcels: privateParcels.length,
			sampledBlocks: chosen.length,
			houses: houses.length,
			movementNodes: movement.network.nodes.length,
			movementEdges: movement.network.edges.length,
			latticeNodes: lattice.nodes.length,
			latticeMembers: lattice.edges.length,
			...drawables
		},
		totalMs: round(performance.now() - started),
		peakRssMiB: round(process.resourceUsage().maxRSS / 1024)
	};
}

export type Pipeline = ReturnType<typeof measure>;

export function townFixtures() {
	const { world, projection, points, brushParams: params } = createTownSandbox();
	const edits = world.holdings.parcels
		.filter(({ publicUse }) => !publicUse)
		.map(({ id }) => world.place('house/court-neutral', { kind: 'parcel', id }, params));
	function save(count: number) {
		if (edits.length < count) throw new Error(`Only ${edits.length} eligible load addresses`);
		const document = world.createDocument();
		document.apply(edits.slice(0, count));
		return { count, contents: document.serialize() };
	}
	return {
		world,
		projection,
		points,
		saves: { small: save(protocol.perfSmallLoadPlacements.value), town: save(edits.length) }
	};
}

if (import.meta.main) console.log(JSON.stringify(measure(process.argv[2] === 'largest')));
