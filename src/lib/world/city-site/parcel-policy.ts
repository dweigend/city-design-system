import { parcelSettings as settings } from '../../../config/parcels';
import { measurePolygon, type Vec2 } from '../../core/geometry';
import { required } from '../../core/invariant';
import { Random } from '../../core/random';
import { createCityDistricts, type DistrictKind } from '../../domain/city-volume';
import {
	createParcelPlan,
	type HoldingRule,
	type LaneInput,
	type MergeProposal
} from '../../domain/parcels';
import { planEdgeId, type PlanEdge, type TerrainGrid } from '../../domain/terrain-grid';
import { frontageDistance } from './lane-policy';

const { minimumFrontageM } = settings;
const holdingRules = {
	detached: {
		minimumFrontageM,
		partition: {
			targetAreaM2: settings.detachedTargetM2,
			minimumAreaM2: settings.detachedMinimumM2
		}
	},
	block: {
		minimumFrontageM,
		partition: {
			targetAreaM2: settings.perimeterTargetM2,
			minimumAreaM2: settings.perimeterMinimumM2
		},
		court: { insetM: settings.courtInsetM, passageWidthM: settings.passageWidthM }
	},
	center: {
		minimumFrontageM,
		partition: { targetAreaM2: settings.centerTargetM2, minimumAreaM2: settings.centerMinimumM2 }
	},
	square: { minimumFrontageM, publicUse: true },
	hall: { minimumFrontageM }
} satisfies Record<string, HoldingRule>;

type Growth = readonly Readonly<{ id: string; builtArea: number; complete: boolean }>[];

type EligibleCell = {
	area: number;
	grade: number;
	distance: number;
	promenade: boolean;
};

function readEligible(
	grid: TerrainGrid,
	lanes: readonly LaneInput[],
	planned: Readonly<Record<string, DistrictKind>>,
	gradeOf: (edge: PlanEdge) => number
) {
	const points = new Map(grid.vertices.map(({ id, position: [x, y] }) => [id, [x, y] as Vec2]));
	const point = (id: string) => required(points.get(id), 'planned corner');
	const lanesByEdge = new Map(lanes.map((lane) => [lane.edge.id, lane]));
	const eligible = new Map<string, EligibleCell>();
	for (const { id, vertexIds } of grid.cells) {
		const { centroid, area } = measurePolygon(vertexIds.map(point));
		if (!centroid) continue;
		let grade = 0;
		let distance = Infinity;
		let promenade = false;
		for (const [i, from] of vertexIds.entries()) {
			const to = vertexIds[(i + 1) % vertexIds.length];
			const lane = required(lanesByEdge.get(planEdgeId(from, to)), 'planned lane');
			grade = Math.max(grade, gradeOf(lane.edge));
			promenade ||= lane.hierarchy.includes('promenade');
			if (!lane.hierarchy.includes('local') || lane.protectedFromMerge)
				distance = Math.min(distance, frontageDistance(centroid, [point(from), point(to)]));
		}
		if (
			grade <= settings.mergeGradeRatio &&
			(Number.isFinite(distance) || planned[id] !== 'detached')
		)
			eligible.set(id, { area, grade, distance, promenade });
	}
	return eligible;
}

function mergeProposals(
	lanes: readonly LaneInput[],
	eligible: ReadonlyMap<string, EligibleCell>,
	order: Growth,
	nominalSideM: number,
	seed: number
): MergeProposal[] {
	const rank = new Map(order.map(({ id }, index) => [id, index]));
	const random = Random.create({ seed });
	const candidates = lanes.flatMap(({ edge: { cellIds }, protectedFromMerge }) => {
		if (protectedFromMerge || cellIds.length !== 2) return [];
		const [a, b] = cellIds;
		const u = eligible.get(a);
		const v = eligible.get(b);
		const i = rank.get(a);
		const j = rank.get(b);
		// Contracting consecutive legal admissions preserves their prefix topology.
		if (!u || !v || i === undefined || j === undefined || Math.abs(i - j) !== 1) return [];
		const memberCellIds = [a, b].sort() as [string, string];
		return [
			{
				memberCellIds,
				plannedKind: u.promenade || v.promenade ? 'square' : 'hall',
				area: u.area + v.area,
				distance: Math.min(u.distance, v.distance) / nominalSideM,
				grade: Math.max(u.grade, v.grade),
				tie: random.derive(JSON.stringify(['R10a', 'merge', memberCellIds])).number()
			}
		];
	});
	candidates.sort((a, b) => a.distance - b.distance || a.grade - b.grade || a.tie - b.tie);
	const areaBudget =
		[...eligible.values()].reduce((m2, { area }) => m2 + area, 0) * settings.mergeShareRatio;
	const taken = new Set<string>();
	const selected: MergeProposal[] = [];
	let area = 0;
	for (const proposal of candidates) {
		if (area + proposal.area > areaBudget || proposal.memberCellIds.some((id) => taken.has(id)))
			continue;
		area += proposal.area;
		for (const id of proposal.memberCellIds) taken.add(id);
		selected.push(proposal);
	}
	return selected;
}

export function prepareCityParcels(
	grid: TerrainGrid,
	order: Growth,
	lanes: readonly LaneInput[],
	grade: (edge: PlanEdge) => number,
	core: Parameters<typeof createCityDistricts>[1],
	nominalSideM: number,
	seed: number,
	levelHeightM: number
) {
	const rankedCellIds = order.map(({ id }) => id);
	const districts = createCityDistricts(
		grid,
		core,
		seed,
		undefined,
		{ planScope: grid.identity.scope, rankedCellIds, futureFringe: [] },
		levelHeightM
	);
	const plannedKinds = Object.fromEntries(rankedCellIds.map((id) => [id, districts.cell(id).kind]));
	const eligible = readEligible(grid, lanes, plannedKinds, grade);
	const merges = mergeProposals(lanes, eligible, order, nominalSideM, seed);
	const parcels = createParcelPlan({
		grid,
		lanes,
		merges,
		plannedKinds,
		holdingRules,
		tolerance: settings
	});
	const rank = new Map(rankedCellIds.map((id, i) => [id, i]));
	const starts = new Set(
		parcels.mergedUnits.map(({ memberCellIds }) =>
			Math.min(...memberCellIds.map((id) => required(rank.get(id), 'merged growth rank')))
		)
	);
	return {
		parcels,
		order: order.map((step, index) => (starts.has(index) ? { ...step, complete: false } : step))
	};
}
