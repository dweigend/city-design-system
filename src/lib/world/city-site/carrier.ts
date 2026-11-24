import type { Vec2 } from '../../core/geometry';
import {
	cityAccessibility,
	cityGrowth,
	levelHeight,
	type CityPlanVariant
} from '../../domain/city-volume';
import {
	dryPlanEdges,
	planCellSide,
	shorelineMorphLimits,
	TerrainGrid
} from '../../domain/terrain-grid';
import { laneGrades, laneReservations } from './lane-policy';
import { prepareCityParcels } from './parcel-policy';
import { shoreDetours } from './promenade';
import { createMainLaneRouter, type MainLanePath } from './main-lanes';
import { planGround } from './sampling';
import { crossingApproaches, type CarrierSite, type CityRecipe } from './recipe';
import {
	citySiteConfig as config,
	citySiteDimensions as dimensions
} from '../../../config/city-site';

export function prepareCarrier(
	site: CarrierSite,
	coarseCellSize: number,
	variant: CityPlanVariant,
	seed: number,
	maximumAreaM2: number,
	recipe: CityRecipe
) {
	const { sampleGround, origin, bearing } = site;
	const span = { along: dimensions.citySizeMaximumM / 2, across: dimensions.cityCarrierHalfWidthM };
	const u = Math.cos(bearing);
	const v = Math.sin(bearing);
	const outline = /* Exact arithmetic: normalized carrier outline. */ [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([a, b]): Vec2 => [
		origin[0] + a * span.along * u - b * span.across * v,
		origin[1] + a * span.along * v + b * span.across * u
	]);
	const ground = planGround(sampleGround, config.bankSetbackM);
	const { grid: candidates, plan } = TerrainGrid.createPlan(
		{
			seed,
			site: { origin, bearing, outline },
			variant,
			parameters: { cellSize: coarseCellSize / planCellSide[variant] },
			maximumCellRise: config.maximumCellRiseM,
			edgeSampleStep: config.groundSampleStepM,

			shore: {
				align: true,
				clearanceAt: ground.clearanceAt,
				minimumEdge: shorelineMorphLimits.clippedMinimumEdgeRatio * coarseCellSize,
				minimumArea: shorelineMorphLimits.clippedMinimumAreaRatio * coarseCellSize ** 2
			},
			referenceHeightAt: (x, y) => sampleGround(x, y).height,
			heightAt: ground.heightAt
		},
		(point) => {
			const ground = sampleGround(...point);
			return ground.waterKind ?? 'dry';
		}
	);
	const { crossings, primary, approaches, heads, secondBank } = crossingApproaches(
		site,
		plan,
		candidates,
		seed,
		recipe
	);
	const dryEdges = dryPlanEdges(candidates, plan);
	const mainLanes: MainLanePath[] = [];
	const grade = laneGrades(candidates, sampleGround);
	const isWalkable = recipe.approach?.isWalkable;
	const route = createMainLaneRouter(
		candidates,
		grade,
		isWalkable && ((point) => isWalkable(sampleGround(...point)))
	);
	const access = cityAccessibility(
		seed,
		heads,
		bearing,
		sampleGround,
		secondBank,
		(guide, armKey, head) => {
			const routed = route(guide, armKey, approaches?.find(({ point }) => point === head)?.nodeId);
			if (!routed) return [];
			mainLanes.push(
				Object.freeze({ ...routed.path, ...(primary ? { crossingId: primary.id } : {}) })
			);
			return routed.points;
		},
		recipe.approach
	);
	const links = crossings.flatMap(({ heads: [a, b], path }) =>
		a.cellIds.flatMap((from) =>
			b.cellIds.map((to) => ({
				headIds: [from, to] as const,
				spanM: path.lengthM
			}))
		)
	);
	const rawOrder = cityGrowth(
		candidates,
		(point, grade) => access(point, grade, sampleGround(...point).waterClearance),
		recipe.minimumRegionAreaM2,
		links,
		recipe.growth
	);
	const maximumOrder = growthPrefix(rawOrder, maximumAreaM2);
	const maximumGrid = TerrainGrid.select(
		candidates,
		maximumOrder.map(({ id }) => id)
	);
	const eligible = new Set(maximumOrder.map(({ id }) => id));
	const edges = dryEdges.filter(({ cellIds }) => cellIds.some((id) => eligible.has(id)));
	const headIds = new Set(crossings.flatMap(({ heads }) => heads.map(({ nodeId }) => nodeId)));
	const lanes = laneReservations(
		edges,
		mainLanes,
		headIds,
		grade,
		shoreDetours(maximumGrid, edges, sampleGround)
	);
	const { order, parcels } = prepareCityParcels(
		maximumGrid,
		maximumOrder,
		lanes,
		grade,
		/* Exact arithmetic: unit aspect keeps the initial plan round. */ {
			origin,
			bearing,
			aspect: 1
		},
		coarseCellSize,
		seed
	);
	const ranks = new Map(order.map(({ id }, index) => [id, index]));
	const lowest = candidates.vertices.reduce(
		(low, { position }) => Math.min(low, position[2]),
		Infinity
	);
	const datumZ = Number.isFinite(lowest) ? levelHeight * Math.floor(lowest / levelHeight) : 0;
	return {
		candidates,
		plan,
		crossings,
		order,
		ranks,
		datumZ,
		parcels,
		mainLanes: Object.freeze(mainLanes)
	};
}

/** Takes the first complete growth step that reaches the area target in square meters. */
export function growthPrefix(order: ReturnType<typeof cityGrowth>, targetAreaM2: number) {
	const cutoff = order.findIndex(
		({ builtArea, complete }) => complete && builtArea >= targetAreaM2
	);
	return cutoff < 0 ? order : order.slice(0, cutoff + 1);
}
