import { defaults } from '../../../config/structure';
import { readMemberSection, type MemberGraph } from './graph';
import { gravityRoutes } from './routes';

/** Nonnegative downward force in kN, applied once per joint. */
export type JointLoad = Readonly<{ joint: string; forceKN: number }>;

/** Relative tolerance for checking the vertical force balance. */
export const gravityBalanceTolerance = defaults.balanceToleranceRatio;

// Exact arithmetic: binary64 minimum normal positive number.
const minimumNormal = /* Exact arithmetic: minimum binary64 normal exponent. */ 2 ** -1022;

// A validated graph is detached and frozen, so its routing is valid for its lifetime.
const routes = new WeakMap<MemberGraph, ReturnType<typeof gravityRoutes>>();

function jointForces(
	graph: MemberGraph,
	loads: readonly JointLoad[],
	jointIndices: ReadonlyMap<string, number>
) {
	const forces = graph.joints.map(() => /* Exact arithmetic: unloaded joints start at zero. */ 0);
	const seen = new Set<number>();
	for (const { joint, forceKN } of loads) {
		const index = jointIndices.get(joint);
		if (index === undefined) throw new RangeError(`Unknown load joint "${joint}"`);
		if (seen.has(index)) throw new RangeError(`Duplicate load at joint "${joint}"`);
		if (!Number.isFinite(forceKN) || forceKN < 0)
			throw new RangeError(`Invalid force at joint "${joint}"`);
		seen.add(index);
		forces[index] = forceKN;
	}
	return forces;
}

function routeForces(
	force: number[],
	order: readonly number[],
	exits: ReturnType<typeof gravityRoutes>['exits']
) {
	const transfers = new Map<number, { verticalKN: number; slope: number }>();
	for (const joint of order) {
		const load = force[joint];
		if (!load) continue;
		const links = exits[joint];
		let fraction = 0;
		let sentKN = 0;
		for (let i = 0; i < links.length; i++) {
			const { share, member, joint: receiver, slope } = links[i];
			let verticalKN = load * share;
			// Round cumulative subnormal shares so fractions of the last representable unit
			// add up to the original load in graph order.
			if (load < minimumNormal) {
				fraction += share;
				const throughKN = i + 1 === links.length ? load : load * Math.min(1, fraction);
				verticalKN = throughKN - sentKN;
				sentKN = throughKN;
			}
			force[receiver] += verticalKN;
			transfers.set(member, { verticalKN, slope });
		}
	}
	return transfers;
}

function finite(value: number) {
	return Number.isFinite(value) ? value : null;
}

/** Routes nonnegative gravity loads to reachable supports. Outputs are detached in graph
 * order, with force in kN and unitless nominal utilization. Unsupported joints and unreacted
 * force are reported even for disconnected graphs. Invalid load cases throw RangeError. */
export function runGravity(graph: MemberGraph, loads: readonly JointLoad[]) {
	let topology = routes.get(graph);
	if (!topology) {
		topology = gravityRoutes(graph);
		routes.set(graph, topology);
	}
	const { hops, order, exits, jointIndices } = topology;
	const force = jointForces(graph, loads, jointIndices);
	const appliedKN = force.reduce((sum, value) => sum + value, 0);
	if (!Number.isFinite(appliedKN)) throw new RangeError('Total applied force must be finite');

	const transfers = routeForces(force, order, exits);

	const reactions = graph.joints.flatMap(({ id, support }, i) =>
		support === 'free' ? [] : [Object.freeze({ joint: id, forceKN: force[i] })]
	);
	const unsupported = graph.joints.flatMap(({ id }, i) => (hops[i] === Infinity ? [id] : []));
	const unreactedKN = force.reduce((sum, load, i) => sum + (hops[i] === Infinity ? load : 0), 0);
	const reactedKN = reactions.reduce((sum, { forceKN }) => sum + forceKN, 0);
	const balanceErrorKN = appliedKN - reactedKN - unreactedKN;
	const balanced = Math.abs(balanceErrorKN) <= appliedKN * gravityBalanceTolerance;

	return Object.freeze({
		status: unsupported.length ? ('unrouted' as const) : ('routed' as const),
		appliedKN,
		reactedKN,
		unreactedKN,
		balanceErrorKN,
		balanced,
		unsupported: Object.freeze(unsupported),
		reactions: Object.freeze(reactions),
		members: Object.freeze(
			graph.members.map(({ id, section }, i) => {
				const transfer = transfers.get(i);
				const verticalKN = transfer?.verticalKN ?? 0;
				const { areaM2, referenceStressKPa } = readMemberSection(graph, section);
				const stressKPa =
					referenceStressKPa ?? graph.definitions?.referenceStressKPa ?? defaults.nominalStressKPa;
				const capacityKN = areaM2 * stressKPa;
				const axialKN = transfer && transfer.slope > 0 ? finite(verticalKN / transfer.slope) : null;
				return Object.freeze({
					id,
					verticalKN,
					axialKN,
					utilization: axialKN === null ? null : finite(axialKN / capacityKN)
				});
			})
		)
	});
}

/** Vertical force balance, support reactions and per-member estimates. */
export type GravityResult = ReturnType<typeof runGravity>;
