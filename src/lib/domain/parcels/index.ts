import { required } from '../../core/invariant';
import { prepareBlocks } from './blocks';
import { laneAddress } from './reserve';
import type { ParcelLane, ParcelPlanInput } from './types';

export type {
	CourtEntrance,
	HoldingRule,
	LaneInput,
	MergeProposal,
	Parcel,
	ParcelBlock,
	ParcelLane,
	ParcelPlanInput,
	ParcelPortal,
	ParcelTolerance,
	PlanPolygon
} from './types';

/** Prepares fixed block membership and pedestrian reservations for caller-supplied XY geometry.
 * Proposed pairs are considered in input order. A rejected pair leaves its cells available.
 * A read returns a frozen snapshot of the requested whole blocks and their permanent lane intervals. */
export function createParcelPlan(input: ParcelPlanInput) {
	const specs = new Map(input.lanes.map((lane) => [lane.edge.id, lane]));
	const { byCell, mergedUnits, point, realize } = prepareBlocks(input, specs);
	const lanes = new Map<string, ParcelLane>();
	for (const spec of specs.values()) {
		const { edge, hierarchy, widthM, surface } = spec;
		const incident = [...new Set(edge.cellIds.flatMap((id) => byCell.get(id)?.id ?? []))].sort();
		if (
			!incident.length ||
			(edge.cellIds.length > 1 && edge.cellIds.every((id) => byCell.get(id)?.id === incident[0]))
		)
			continue;
		const id = laneAddress(spec);
		const [a, b] = edge.nodeIds;
		lanes.set(
			id,
			Object.freeze({
				id,
				edgeId: edge.id,
				nodeIds: Object.freeze([a, b] as const),
				provenance: Object.freeze({ ...edge.provenance }),
				points: Object.freeze([point(a), point(b)] as const),
				lengthM: edge.lengthM,
				widthM,
				hierarchy: Object.freeze([...hierarchy]),
				surface,
				blockIds: Object.freeze(incident)
			})
		);
	}
	const pairs = Object.freeze(
		mergedUnits.map(({ memberCellIds, plannedKind, id }) =>
			Object.freeze({ memberCellIds, plannedKind, id })
		)
	);

	return Object.freeze({
		mergedUnits: pairs,
		/** Reads a detached growth selection in canonical address order. Throws for a partial pair or unknown cell. */
		read(cellIds: readonly string[] = [...byCell.keys()]) {
			const active = new Set(cellIds);
			const selected = new Map(
				cellIds.map((id) => {
					const block = required(byCell.get(id), 'selected block member');
					if (block.memberCellIds.some((member) => !active.has(member)))
						throw Error('A merged holding must be selected whole');
					return [block.id, block] as const;
				})
			);
			const realized = [...selected.keys()]
				.sort()
				.map((id) => realize(required(selected.get(id), 'selected block')));
			const blocks = realized.map(({ block }) => block);
			const laneIds = new Set(blocks.flatMap(({ laneIds }) => laneIds));
			return Object.freeze({
				lanes: Object.freeze(
					[...laneIds].sort().map((id) => required(lanes.get(id), 'selected lane'))
				),
				blocks: Object.freeze(blocks),
				parcels: Object.freeze(realized.flatMap(({ parcels }) => parcels)),
				portals: Object.freeze(realized.flatMap(({ portals }) => portals)),
				mergedUnits: Object.freeze(pairs.filter(({ id }) => selected.has(id)))
			});
		}
	});
}

/** Addresses, block reserves and lane intervals of one growth selection. */
export type ParcelPlan = ReturnType<ReturnType<typeof createParcelPlan>['read']>;
