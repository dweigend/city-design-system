import { arch, cpus, release } from 'node:os';
import { distance, measurePolygon, type Vec2 } from '../src/lib/core/geometry';
import { required } from '../src/lib/core/invariant';
import type { CityDistricts } from '../src/lib/domain/city-volume';
import { planEdgeId } from '../src/lib/domain/terrain-grid';
import type { ParcelBlock, ParcelLane, PlanPolygon } from '../src/lib/domain/parcels';
import {
	createCitySite,
	readCityGrid,
	readCityParcels,
	type CityGrid
} from '../src/lib/world/city-site';
import {
	parcelAreaEstimates,
	parcelStudyLimits,
	parcelTimingRuns,
	parcelTimingWarmups
} from './config/city-study';

type Layout = ReturnType<typeof readCityParcels>;

function area(polygons: readonly PlanPolygon[]) {
	return polygons.reduce(
		(sum, rings) => sum + rings.reduce((value, ring) => value + measurePolygon(ring).area, 0),
		0
	);
}

function unchanged<T extends { id: string }>(before: readonly T[], after: readonly T[]) {
	const next = new Map(after.map((part) => [part.id, part]));
	return before.every((part) => JSON.stringify(part) === JSON.stringify(next.get(part.id)));
}

export function parcelGrowthStable(before: Layout, after: Layout) {
	return (
		unchanged(before.lanes, after.lanes) &&
		unchanged(before.blocks, after.blocks) &&
		unchanged(before.parcels, after.parcels) &&
		unchanged(before.portals, after.portals)
	);
}

function findLaneParts(lanes: readonly ParcelLane[]) {
	const links = new Map<string, Set<string>>();
	for (const {
		nodeIds: [a, b]
	} of lanes) {
		const left = links.get(a) ?? new Set<string>();
		const right = links.get(b) ?? new Set<string>();
		left.add(b);
		right.add(a);
		links.set(a, left);
		links.set(b, right);
	}
	const groups = new Map<string, string>();
	for (const start of links.keys()) {
		if (groups.has(start)) continue;
		const queue = [start];
		groups.set(start, start);
		for (const id of queue) {
			for (const next of links.get(id) ?? []) {
				if (groups.has(next)) continue;
				groups.set(next, start);
				queue.push(next);
			}
		}
	}
	return groups;
}

function lanesConnected(layout: CityGrid, parcels: Layout) {
	const parts = findLaneParts(parcels.lanes);
	for (const { heads } of layout.crossings) {
		if (heads.some(({ nodeId }) => !parts.has(nodeId))) return false;
	}
	const blocksByCell = new Map(
		parcels.blocks.flatMap((block) => block.memberCellIds.map((id) => [id, block] as const))
	);
	const lanes = new Map(parcels.lanes.map((lane) => [lane.id, lane]));
	const groupOf = (block: ParcelBlock) => {
		const group = new Set(
			block.laneIds.map((id) => parts.get(required(lanes.get(id), 'block lane').nodeIds[0]))
		);
		return group.size === 1 ? [...group][0] : undefined;
	};
	const groups = new Map(parcels.blocks.map((block) => [block.id, groupOf(block)]));
	return layout.grid.cells.every(({ id, neighbors }) => {
		const block = required(blocksByCell.get(id), 'study block');
		const own = groups.get(block.id);
		return (
			own !== undefined &&
			neighbors.every(
				(other) =>
					other === null ||
					own === groups.get(required(blocksByCell.get(other), 'neighbor block').id)
			)
		);
	});
}

function perimeter(ring: readonly Vec2[]) {
	return ring.reduce((m, p, i) => m + distance(p, ring[(i + 1) % ring.length]), 0);
}

function quantile(values: readonly number[], ratio: number) {
	if (!values.length) return 0;
	const ordered = [...values].sort((a, b) => a - b);
	return ordered[Math.max(0, Math.ceil(ratio * ordered.length) - 1)];
}

function describe(values: readonly number[]) {
	return { p10: quantile(values, 0.1), median: quantile(values, 0.5), p90: quantile(values, 0.9) };
}

function holdingGroups(plan: Layout, districts: CityDistricts) {
	const blocks = new Map(plan.blocks.map((block) => [block.id, block]));
	const portals = new Map(plan.portals.map((portal) => [portal.id, portal]));
	const groups = new Map<
		string,
		{ kind: string; density: string; areas: number[]; fronts: number[]; depths: number[] }
	>();
	for (const parcel of plan.parcels) {
		const { plannedKind: kind, areaM2, portalId, outline } = parcel;
		const block = required(blocks.get(parcel.blockId), 'holding block');
		const density = [...new Set(block.memberCellIds.map((id) => districts.cell(id).kind))]
			.sort()
			.join('+');
		const key = JSON.stringify([kind, density]);
		const bucket = groups.get(key) ?? { kind, density, areas: [], fronts: [], depths: [] };
		const {
			points: [a, b],
			frontageM
		} = required(portals.get(portalId), 'holding entrance');
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		bucket.areas.push(areaM2);
		bucket.fronts.push(frontageM);
		bucket.depths.push(
			Math.max(...outline.map(([x, y]) => Math.abs(dx * (y - a[1]) - dy * (x - a[0])) / frontageM))
		);
		groups.set(key, bucket);
	}
	return [...groups.values()].map(({ kind, density, areas, fronts, depths }) => {
		const range = parcelAreaEstimates.get(kind);
		const below = range ? areas.filter((m2) => m2 < range[0]).length : 0;
		const above = range ? areas.filter((m2) => m2 > range[1]).length : 0;
		return {
			kind,
			density,
			count: areas.length,
			areaM2: describe(areas),
			frontageM: describe(fronts),
			depthM: describe(depths),
			...(range
				? {
						estimateRangeM2: range,
						shareBelowEstimate: below / areas.length,
						shareAboveEstimate: above / areas.length
					}
				: {})
		};
	});
}

export function parcelMetrics(
	layout: CityGrid,
	plan: Layout,
	districts: CityDistricts,
	earlier: Layout,
	grown: Layout
) {
	const totals = {
		grossAreaM2: 0,
		mergedAreaM2: 0,
		openAreaM2: 0,
		grossPerimeterM: 0,
		netPerimeterM: 0,
		maximumAreaErrorM2: 0
	};
	const failures: string[] = [];
	for (const block of plan.blocks) {
		const { grossAreaM2, laneAreaM2, accounting, parcelableGround, outline, memberCellIds } = block;
		const error = Math.abs(
			grossAreaM2 -
				laneAreaM2 -
				accounting.parcelAreaM2 -
				accounting.passageAreaM2 -
				accounting.courtAreaM2 -
				accounting.openAreaM2
		);
		const tiling = Math.abs(area(parcelableGround) - accounting.parcelAreaM2);
		const tolerance = Math.max(
			parcelStudyLimits.areaAbsoluteM2,
			grossAreaM2 * parcelStudyLimits.areaRelativeRatio
		);
		if (error > tolerance || tiling > tolerance) failures.push('area ' + block.id);
		totals.grossAreaM2 += grossAreaM2;
		totals.mergedAreaM2 += memberCellIds.length > 1 ? grossAreaM2 : 0;
		totals.openAreaM2 += accounting.openAreaM2;
		totals.grossPerimeterM += perimeter(outline);
		totals.netPerimeterM += parcelableGround.reduce(
			(m, rings) => m + rings.reduce((sum, ring) => sum + perimeter(ring), 0),
			0
		);
		totals.maximumAreaErrorM2 = Math.max(totals.maximumAreaErrorM2, error, tiling);
	}
	const laneIds = new Set(plan.lanes.map(({ id }) => id));
	const portals = new Map(plan.portals.map((portal) => [portal.id, portal]));
	if (
		plan.parcels.some(({ portalId }) => {
			const portal = portals.get(portalId);
			return (
				!portal || portal.frontageM < parcelStudyLimits.frontageM || !laneIds.has(portal.laneId)
			);
		})
	)
		failures.push('frontage');
	if (!lanesConnected(layout, plan)) failures.push('pedestrian components/crossing heads');
	if (!parcelGrowthStable(earlier, grown)) failures.push('growth prefix');
	const merged = new Map(
		plan.mergedUnits.flatMap((block) => block.memberCellIds.map((id) => [id, block.id] as const))
	);
	const dryEdges = new Map(plan.lanes.map((lane) => [lane.edgeId, lane]));
	for (const { id, vertexIds, neighbors } of layout.grid.cells) {
		if (!merged.has(id)) continue;
		for (const [i, neighbor] of neighbors.entries()) {
			if (
				neighbor !== null &&
				merged.get(neighbor) === merged.get(id) &&
				dryEdges.has(planEdgeId(vertexIds[i], vertexIds[(i + 1) % vertexIds.length]))
			)
				failures.push('merged seam ' + id);
		}
	}
	const laneKm: Record<string, number> = {};
	let stairKm = 0;
	for (const { lengthM, hierarchy, surface } of plan.lanes) {
		const role = hierarchy[0];
		laneKm[role] = (laneKm[role] ?? 0) + lengthM / 1000;
		if (surface === 'stairs') stairKm += lengthM / 1000;
	}
	const courts = plan.blocks.filter(({ courtFit }) => courtFit !== 'not-planned');
	const fittedCourts = courts.filter(({ courtFit }) => courtFit === 'fit').length;
	return {
		...totals,
		blocks: plan.blocks.length,
		parcels: plan.parcels.length,
		portals: plan.portals.length,
		laneKm,
		stairKm,
		mergedAreaShare: totals.mergedAreaM2 / totals.grossAreaM2,
		fittedCourts,
		plannedCourts: courts.length,
		courtFitRate: courts.length ? fittedCourts / courts.length : 0,
		holdingGroups: holdingGroups(plan, districts),
		failures: [...new Set(failures)]
	};
}

export function measureParcelTiming(sizeM: number, seed: number) {
	const prep: number[] = [];
	const first: number[] = [];
	const cached: number[] = [];
	let activeCells = 0;
	let candidateCells = 0;
	for (let i = -parcelTimingWarmups; i < parcelTimingRuns; i++) {
		const site = createCitySite(undefined, { seed });
		const start = performance.now();
		const layout = readCityGrid(site, sizeM, 'organic', seed);
		const prepared = performance.now();
		readCityParcels(site, layout);
		const realized = performance.now();
		readCityParcels(site, layout);
		const done = performance.now();
		activeCells = layout.grid.cells.length;
		candidateCells = layout.candidateCellCount;
		if (i < 0) continue;
		prep.push(prepared - start);
		first.push(realized - prepared);
		cached.push(done - realized);
	}
	const stats = (series: number[]) => ({ p50: quantile(series, 0.5), p95: quantile(series, 0.95) });
	return {
		sizeM,
		seed,
		activeCells,
		candidateCells,
		preparationMs: stats(prep),
		firstReadMs: stats(first),
		cachedReadMs: stats(cached),
		runs: parcelTimingRuns,
		warmups: parcelTimingWarmups,
		cpu: cpus()[0]?.model,
		os: release(),
		arch: arch(),
		bun: Bun.version,
		peakRssKiB: process.resourceUsage().maxRSS
	};
}
