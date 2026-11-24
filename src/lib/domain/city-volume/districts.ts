import { measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { Random } from '../../core/random';
import type { TerrainGrid } from '../terrain-grid';
import { districtRank, type CityCore } from './rank';
import {
	districtLevels,
	districtShares,
	maximumLevelStep,
	peakLevels,
	settlementOf,
	type SettlementKind
} from './settlement';

export type DistrictKind = 'detached' | 'block' | 'center';
export type DistrictCell = Readonly<{
	districtId: string;
	densityRegionId: string;
	kind: DistrictKind;
	levels: number;
}>;

type PlanCell = Readonly<{
	id: string;
	centroid: Vec2;
	area: number;
	neighbors: readonly string[];
}>;
export type DistrictGrowth = Readonly<{
	rankedCellIds: readonly string[];
	futureFringe: readonly string[];
}>;

type Ranked = PlanCell & Readonly<{ rank: number; share: number }>;

function planCells(plan: TerrainGrid): PlanCell[] {
	const vertices = new Map(plan.vertices.map(({ id, position }) => [id, position]));
	return plan.cells.map(({ id, vertexIds, neighbors }) => {
		const points = vertexIds.map((key) => required(vertices.get(key), 'district corner'));
		const { area, centroid } = measurePolygon(points);
		return {
			id,
			centroid: required(centroid, 'district centroid'),
			area,
			neighbors: neighbors.filter((neighbor) => neighbor !== null)
		};
	});
}

/** Orders cells from the core outward and records the area share up to each cell's middle. */
function rankCells(cells: readonly PlanCell[], rank: (cell: PlanCell) => number) {
	const ordered = cells
		.map((cell) => ({ cell, rank: rank(cell) }))
		.sort((a, b) => a.rank - b.rank || (a.cell.id < b.cell.id ? -1 : 1));
	const total = ordered.reduce((sum, { cell }) => sum + cell.area, 0);
	let cumulative = 0;
	const ranked: Ranked[] = ordered.map(({ cell, rank }) => {
		cumulative += cell.area;
		return { ...cell, rank, share: (cumulative - cell.area / 2) / total };
	});
	return { ranked, total };
}

/** A bell over the center: full height at its heart, the podium at its rim. Seeded tower noise
 * lowers some columns so only a few stand at the top. */
function centerLevels(t: number, peak: number, towerNoise: number) {
	const podium = districtLevels.block;
	const bell = (1 - t) ** 2;
	return Math.round(podium + Math.max(0, peak - podium) * bell * towerNoise);
}

/** Raises center columns to at most one level step below their highest neighbor, so a tower
 * stands on stepped flanks instead of being cut down by the step limit. */
function supportPeaks(
	levels: Map<string, number>,
	cells: readonly PlanCell[],
	kinds: ReadonlyMap<string, DistrictKind>
) {
	const center = cells.filter(({ id }) => kinds.get(id) === 'center');
	let changed = true;
	while (changed) {
		changed = false;
		for (const { id, neighbors } of center) {
			const reach = Math.max(
				...neighbors.map((neighbor) => required(levels.get(neighbor), 'step neighbor'))
			);
			if (required(levels.get(id), 'step column') < reach - maximumLevelStep) {
				levels.set(id, reach - maximumLevelStep);
				changed = true;
			}
		}
	}
}

/** Lowers every column to at most one level step above its lowest neighbor's reach, which
 * bounds each neighbor jump. Columns only ever move down, so the pass terminates. */
function limitSteps(
	levels: Map<string, number>,
	cells: readonly PlanCell[],
	fringe: ReadonlySet<string>
) {
	let changed = true;
	while (changed) {
		changed = false;
		for (const { id, neighbors } of cells) {
			const reach = Math.min(
				fringe.has(id) ? districtLevels.detached : Infinity,
				...neighbors.map((neighbor) => required(levels.get(neighbor), 'step neighbor'))
			);
			const cap = reach + maximumLevelStep;
			if (required(levels.get(id), 'step column') > cap) {
				levels.set(id, cap);
				changed = true;
			}
		}
	}
}

/** The earliest founding address names each connected region. A merger keeps the earlier founder. */
function regionIds(ranked: readonly Ranked[], kinds?: ReadonlyMap<string, DistrictKind>) {
	const byId = new Map(ranked.map((cell) => [cell.id, cell]));
	const ids = new Map<string, string>();
	for (const start of ranked) {
		if (ids.has(start.id)) continue;
		const kind = kinds?.get(start.id);
		const id = `${kind ?? 'district'}/${start.id}`;
		const queue = [start];
		ids.set(start.id, id);
		for (const cell of queue) {
			for (const neighbor of cell.neighbors) {
				if (ids.has(neighbor) || kinds?.get(neighbor) !== kind) continue;
				ids.set(neighbor, id);
				queue.push(required(byId.get(neighbor), 'district neighbor'));
			}
		}
	}
	return ids;
}

function assignKinds(ranked: readonly Ranked[], areaKm2: number) {
	const { block, center } = districtShares(areaKm2);
	return new Map(
		ranked.map(({ id, share }): [string, DistrictKind] => [
			id,
			share < center ? 'center' : share < center + block ? 'block' : 'detached'
		])
	);
}

function assignLevels(
	ranked: readonly Ranked[],
	kinds: ReadonlyMap<string, DistrictKind>,
	areaKm2: number,
	peak: number,
	random: Random,
	complexity: number
) {
	const { center } = districtShares(areaKm2);
	const variation = 0.2 + 0.35 * complexity;
	const levels = new Map<string, number>();
	for (const [index, { id, share }] of ranked.entries()) {
		const kind = required(kinds.get(id), 'district kind');
		if (kind !== 'center') {
			levels.set(id, districtLevels[kind]);
			continue;
		}
		const noise = index === 0 ? 1 : 1 - variation * random.derive(id).number();
		levels.set(id, centerLevels(share / center, peak, noise));
	}
	return levels;
}

/** Settlement class, realized peak levels and the frozen cell assignment of one plan. */
export type DistrictPlan = Readonly<{
	settlement: SettlementKind;
	areaKm2: number;
	shares: Readonly<Record<DistrictKind, number>>;
	peakLevels: number;
	cells: ReadonlyMap<string, DistrictCell>;
}>;

export function seedDistricts(
	plan: TerrainGrid,
	core: CityCore,
	seed: number,
	complexity: number,
	capLevels: number,
	growth?: DistrictGrowth
): DistrictPlan {
	const random = Random.create({ seed }).derive('city-districts');
	const cells = planCells(plan);
	const fallback = districtRank(core, random.derive('rank'), complexity);
	const ranks = growth && new Map(growth.rankedCellIds.map((id, rank) => [id, rank]));
	const { ranked, total } = rankCells(cells, ({ id, centroid }) =>
		ranks ? required(ranks.get(id), 'growth rank') : fallback(centroid)
	);
	const areaKm2 = total / 1e6;
	const kinds = assignKinds(ranked, areaKm2);
	const peak = Math.min(peakLevels(areaKm2), capLevels);
	const levels = assignLevels(ranked, kinds, areaKm2, peak, random.derive('towers'), complexity);
	supportPeaks(levels, cells, kinds);
	limitSteps(levels, cells, new Set(growth?.futureFringe));
	const ids = regionIds(ranked);
	const densityIds = regionIds(ranked, kinds);
	const assignment = new Map(
		cells.map(({ id }) => [
			id,
			Object.freeze({
				districtId: required(ids.get(id), 'district id'),
				densityRegionId: required(densityIds.get(id), 'density region id'),
				kind: required(kinds.get(id), 'district kind'),
				levels: required(levels.get(id), 'district levels')
			})
		])
	);
	const shares: Record<DistrictKind, number> = { detached: 0, block: 0, center: 0 };
	for (const { id, area } of ranked)
		shares[required(kinds.get(id), 'district kind')] += area / total;
	return Object.freeze({
		settlement: settlementOf(areaKm2),
		areaKm2,
		shares: Object.freeze(shares),
		peakLevels: Math.max(0, ...levels.values()),
		cells: assignment
	});
}
