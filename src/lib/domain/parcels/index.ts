/** Module: Reserves movement lanes and fixes addressed holdings on a plan. */
import { required } from '../../core/invariant';
import { prepareBlocks } from './blocks';
import { laneAddress } from './reserve';
import type { HoldingRule, LaneInput, ParcelLane, ParcelPlanInput } from './types';

export type {
	/** A realized parcel with stable corner keys and its implicitly closed CCW ring. */
	AddressedParcel,
	/** An entrance where a public court passage meets an addressed lane. */
	CourtEntrance,
	/** A corner address and its current XY position in meters. */
	HoldingCorner,
	/** Generic holding dimensions and operations, supplied by the caller per kind. */
	HoldingRule,
	/** The city's lane width and roles, assigned by the caller to one clipped edge. */
	LaneInput,
	/** Block merge candidates in preferred order, with the kind of each proposed larger holding. */
	MergeProposal,
	/** A connected holding with an implicitly closed CCW outline and a permanent frontage portal. */
	Parcel,
	/** One usable block with the original cell addresses and a counterclockwise plan boundary. */
	ParcelBlock,
	/** One immutable lane interval with permanent incident block addresses. */
	ParcelLane,
	/** A fixed carrier, reservation policy and holding program. */
	ParcelPlanInput,
	/** Contiguous contact between a parcel and the public side of an addressed lane. */
	ParcelPortal,
	/** Geometry tolerance in meters and the fixed and relative limits on block account rounding. */
	ParcelTolerance,
	/** A simple oriented outer ring and any clockwise holes, in horizontal meters. */
	PlanPolygon
} from './types';

function validateDimension(field: string, value: number, minimum: 'positive' | 'nonnegative') {
	if (!Number.isFinite(value) || (minimum === 'positive' ? value <= 0 : value < 0))
		throw new RangeError(`${field} must be finite and ${minimum}`);
}

function combineReservations(input: readonly LaneInput[]) {
	const specs = new Map<string, LaneInput>();
	for (const lane of input) {
		validateDimension('Lane widthM', lane.widthM, 'nonnegative');
		const previous = specs.get(lane.edge.id);
		if (!previous) {
			specs.set(lane.edge.id, lane);
			continue;
		}
		specs.set(lane.edge.id, {
			edge: lane.edge,
			widthM: Math.max(lane.widthM, previous.widthM),
			hierarchy: [...new Set([...lane.hierarchy, ...previous.hierarchy])].sort(),
			surface: lane.surface === 'stairs' || previous.surface === 'stairs' ? 'stairs' : 'walk',
			oneSided: lane.oneSided || previous.oneSided,
			protectedFromMerge: lane.protectedFromMerge || previous.protectedFromMerge
		});
	}
	return specs;
}

function snapshotHoldingRule(kind: string, rule: HoldingRule): HoldingRule {
	const { minimumFrontageM, partition, court } = rule;
	validateDimension(`${kind}.minimumFrontageM`, minimumFrontageM, 'nonnegative');
	if (partition) {
		validateDimension(`${kind}.targetAreaM2`, partition.targetAreaM2, 'positive');
		validateDimension(`${kind}.minimumAreaM2`, partition.minimumAreaM2, 'nonnegative');
	}
	if (court) {
		validateDimension(`${kind}.insetM`, court.insetM, 'positive');
		validateDimension(`${kind}.passageWidthM`, court.passageWidthM, 'positive');
	}
	return {
		...rule,
		...(partition && { partition: { ...partition } }),
		...(court && { court: { ...court } })
	};
}

/** Prepares fixed block membership and pedestrian reservations for caller-supplied XY geometry.
 * Repeated reservations on the same edge use the largest width and the sorted union of
 * roles. Stairs, one-sided reservation and merge protection apply if any role calls for them.
 * Proposed pairs are considered in input order. A rejected pair leaves its cells available.
 * Zero-width lanes retain frontage and reserve no area. Dimensions and tolerances are validated
 * at preparation (RangeError), and holding rules and tolerances are captured for later reads.
 * A read returns a frozen snapshot of the requested whole blocks and their permanent lane intervals. */
export function createParcelPlan(input: ParcelPlanInput) {
	const specs = combineReservations(input.lanes);
	const tolerance = { ...input.tolerance };
	validateDimension('linearToleranceM', tolerance.linearToleranceM, 'positive');
	validateDimension('areaToleranceM2', tolerance.areaToleranceM2, 'nonnegative');
	validateDimension(
		'relativeAreaToleranceRatio',
		tolerance.relativeAreaToleranceRatio,
		'nonnegative'
	);
	const holdingRules = Object.fromEntries(
		Object.entries(input.holdingRules).map(([kind, rule]) => [
			kind,
			snapshotHoldingRule(kind, rule)
		])
	);
	const { byCell, mergedUnits, point, realize } = prepareBlocks(
		{ ...input, tolerance, holdingRules },
		specs
	);
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
				linearToleranceM: tolerance.linearToleranceM,
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
