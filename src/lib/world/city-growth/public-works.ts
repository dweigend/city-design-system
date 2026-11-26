import { required } from '../../core/invariant';
import type { Vec3 } from '../../core/geometry';
import type { Random } from '../../core/random';
import type { ParcelLane } from '../../domain/parcels';
import { placePublicAsset, readParkGround } from './assets';
import type { GrowthCarrier, HoldingCandidate } from './carrier';
import {
	createBridge,
	createPartBuilder,
	createRailEvents,
	distanceXY,
	freezeGeometry
} from './infrastructure';
import { readCrossing, readUnbuilt, type Frontier } from './crossing';
import { developmentDefaults } from './recipe';
import type { CityGrowthEvent, CityGrowthRecipe } from './types';

export function createPublicWorks(
	carrier: GrowthCarrier,
	recipe: CityGrowthRecipe,
	frontier: Frontier,
	random: Random,
	events: CityGrowthEvent[],
	commit: (event: CityGrowthEvent) => void
) {
	const survey = required(carrier.infrastructure, 'growth infrastructure survey');
	const part = createPartBuilder(carrier.planes.indexAtOrAbove);
	const crossingIds = new Set<string>();
	const founding: HoldingCandidate[] = [];
	const centers = new Map<string, ReadonlySet<string>>();
	let openedCrossing: Extract<CityGrowthEvent, { kind: 'crossing-built' }> | undefined;
	const stationPoints: Vec3[] = [];
	const candidates = new Map(
		[...carrier.holdingsByLane.values()].flat().map((candidate) => [candidate.parcel.id, candidate])
	);
	let hasRail = false;
	function add(event: CityGrowthEvent) {
		if (event.kind === 'holding-settled' && event.reason === 'founding')
			founding.push(required(candidates.get(event.holding.id), 'founding candidate'));
		if (event.kind === 'crossing-built') {
			crossingIds.add(event.crossing.id);
			openedCrossing = event;
		}
		if (event.kind === 'rail-opened') hasRail = true;
		if (event.kind === 'station-opened') centers.set(event.id, new Set(event.catchmentHoldingIds));
	}
	for (const event of events) add(event);

	function bridge(year: number, sequence: number, mayReserveSquare: boolean) {
		const proposal = readCrossing(carrier, survey, frontier, crossingIds);
		if (!proposal) return sequence;
		const { crossing, approach, landingPath, unlocked, fromNodeId, toNodeId: nodeId } = proposal;
		const lanes = [...approach, ...landingPath].map((lane) => ({ ...lane, builtYear: year }));
		const { points, supports, parts } = createBridge(survey, crossing, year, part);
		commit(
			freezeGeometry({
				kind: 'crossing-built',
				year,
				sequence: sequence++,
				crossing,
				fromNodeId,
				toNodeId: nodeId,
				parts,
				lanes,
				unlockedHoldingIds: unlocked.map(({ parcel }) => parcel.id)
			})
		);
		const host = { kind: 'graph-edge' as const, id: 'bridge/' + crossing.id };
		commit(
			placePublicAsset(
				'access/walkway',
				host,
				{ ...host, points, supports },
				points[0],
				{ year, sequence: sequence++ },
				random
			)
		);
		// Leave private growth room on the new bank even if only one candidate is unlocked.
		if (!mayReserveSquare || unlocked.length <= 1) return sequence;
		const point = required(survey.landmarks.get(nodeId), 'market landing');
		const junctionOrder = [...new Set([nodeId, ...landingPath.flatMap(({ nodeIds }) => nodeIds)])];
		const squareChoices = junctionOrder.flatMap((junctionId) => {
			const incident = survey.lanesAtNode.get(junctionId) ?? [];
			const requiredLanes =
				junctionId === nodeId
					? /* Exact arithmetic: crossing plus two bank lanes form a converging junction. */ 2
					: /* Exact arithmetic: three distinct lanes form a converging inland junction. */ 3;
			if (incident.length < requiredLanes) return [];
			return incident.flatMap((lane) => {
				const extras = incident
					.filter((other) => other.id !== lane.id && !frontier.lanes.has(other.id))
					.toSorted((a, b) => a.lengthM - b.lengthM || (a.id < b.id ? -1 : 1));
				const openCount = incident.filter(({ id }) => frontier.lanes.has(id)).length;
				const openedIds = new Set(
					incident.filter(({ id }) => frontier.lanes.has(id)).map(({ id }) => id)
				);
				const added: ParcelLane[] = [];
				if (!openedIds.has(lane.id)) {
					added.push(lane);
					openedIds.add(lane.id);
				}
				for (const extra of extras) {
					if (openedIds.size >= requiredLanes) break;
					added.push(extra);
					openedIds.add(extra.id);
				}
				if (openedIds.size < requiredLanes) return [];
				return (carrier.holdingsByLane.get(lane.id) ?? [])
					.filter(
						({ parcel }) =>
							!frontier.settledIds.has(parcel.id) &&
							!recipe.protectedHoldingIds?.includes(parcel.id)
					)
					.map((candidate) => ({
						candidate,
						junctionId,
						isLanding: junctionId === nodeId,
						openCount,
						added
					}));
			});
		});
		const choice = squareChoices.sort(
			(a, b) =>
				Number(b.isLanding) - Number(a.isLanding) ||
				distanceXY(point, a.candidate.anchor) - distanceXY(point, b.candidate.anchor) ||
				(a.candidate.parcel.id < b.candidate.parcel.id ? -1 : 1)
		)[0];
		if (!choice) return sequence;
		const { parcel, portal, memberCellIds, anchor } = choice.candidate;
		commit(
			freezeGeometry({
				kind: 'square-reserved',
				year,
				sequence: sequence++,
				nodeId: choice.junctionId,
				holding: {
					...parcel,
					portal,
					memberCellIds,
					publicUse: true,
					protected: true,
					builtYear: year
				},
				lanes: choice.added.map((lane) => ({
					...lane,
					builtYear: year
				}))
			})
		);
		const parkHost = { kind: 'parcel' as const, id: parcel.id };
		commit(
			placePublicAsset(
				'park/grove',
				parkHost,
				{ kind: 'parcel', parcel, groundAt: readParkGround(choice.candidate) },
				anchor,
				{ year, sequence: sequence++ },
				random
			)
		);
		return sequence;
	}

	function readCatchment(nodeId: string, point: Vec3, planned: ReadonlySet<string>) {
		const { separationM, catchmentM } = developmentDefaults;
		if (founding.some(({ anchor }) => distanceXY(point, anchor) < separationM)) return;
		if (stationPoints.some((anchor) => distanceXY(point, anchor) < separationM)) return;
		let best: { lane: ParcelLane; ids: string[] } | undefined;
		for (const lane of survey.lanesAtNode.get(nodeId) ?? []) {
			const routes = carrier.accessByLane.get(lane.id) ?? [];
			const ids = routes.flatMap((route) =>
				readUnbuilt(carrier, route, frontier)
					.filter(
						({ anchor, parcel }) =>
							distanceXY(point, anchor) <= catchmentM &&
							founding.every((founder) => distanceXY(founder.anchor, anchor) >= separationM) &&
							!planned.has(parcel.id)
					)
					.map(({ parcel }) => parcel.id)
			);
			if (ids.length > (best?.ids.length ?? 0)) best = { lane, ids };
		}
		if (best) stationPoints.push(point);
		return best;
	}

	function rail(year: number, sequence: number) {
		if (hasRail) return sequence;
		const planned = new Set<string>();
		const additions = createRailEvents(
			survey,
			carrier.planScope,
			{ year, sequence },
			part,
			(nodeId, point) => {
				const catchment = readCatchment(nodeId, point, planned);
				for (const id of catchment?.ids ?? []) planned.add(id);
				return catchment && { ...catchment, open: frontier.lanes.has(catchment.lane.id) };
			}
		);
		if (!additions) return sequence;
		for (const event of additions) commit(event);
		sequence += additions.length;
		for (const event of additions) {
			if (event.kind !== 'station-opened') continue;
			const { position: anchor } = required(
				survey.network?.readNode(event.station.approachId),
				'station approach'
			);
			commit(
				placePublicAsset(
					'sculpture/cantilever-totem',
					{ kind: 'ground', point: anchor },
					{ kind: 'ground', point: anchor },
					anchor,
					{ year, sequence: sequence++ },
					random,
					event.id
				)
			);
		}
		return sequence;
	}

	return {
		add,
		bridge,
		rail,
		centers,
		readNewBank: (year: number) =>
			openedCrossing?.year === year ? new Set(openedCrossing.unlockedHoldingIds) : undefined
	};
}
