import { defaults } from '../../../config/structure';
import { memberSections, type MemberGraph } from './graph';
import { gravityRoutes } from './routes';

/** Nonnegative downward force in kN, applied once per joint. */
export type JointLoad = Readonly<{ joint: string; forceKN: number }>;

/** Relative tolerance for checking the vertical force balance. */
export const gravityBalanceTolerance = defaults.balanceToleranceRatio;

function jointForces(graph: MemberGraph, loads: readonly JointLoad[]) {
	const jointIds = new Set(graph.joints.map(({ id }) => id));
	const byJoint = new Map<string, number>();
	for (const { joint, forceKN } of loads) {
		if (!jointIds.has(joint)) throw new RangeError(`Unknown load joint "${joint}"`);
		if (byJoint.has(joint)) throw new RangeError(`Duplicate load at joint "${joint}"`);
		if (!Number.isFinite(forceKN) || forceKN < 0)
			throw new RangeError(`Invalid force at joint "${joint}"`);
		byJoint.set(joint, forceKN);
	}
	return graph.joints.map(({ id }) => byJoint.get(id) ?? 0);
}

/** Routes nonnegative gravity loads to reachable supports. Outputs are detached in graph
 * order, with force in kN and unitless nominal utilization. Unsupported joints and unreacted
 * force are reported even for disconnected graphs. Invalid load cases throw RangeError. */
export function runGravity(graph: MemberGraph, loads: readonly JointLoad[]) {
	const force = jointForces(graph, loads);
	const appliedKN = force.reduce((sum, value) => sum + value, 0);
	if (!Number.isFinite(appliedKN)) throw new RangeError('Total applied force must be finite');

	const { hops, order, exits } = gravityRoutes(graph);
	const transfers = new Map<number, { verticalKN: number; slope: number }>();
	for (const joint of order) {
		if (!force[joint]) continue;
		const links = exits[joint];
		const weight = links.reduce((sum, link) => sum + link.area, 0);
		for (const link of links) {
			const verticalKN = force[joint] * (link.area / weight);
			force[link.joint] += verticalKN;
			transfers.set(link.member, { verticalKN, slope: link.slope });
		}
	}

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
				const capacityKN = memberSections[section].areaM2 * defaults.nominalStressKPa;
				const axialKN = transfer && transfer.slope > 0 ? verticalKN / transfer.slope : null;
				return Object.freeze({
					id,
					verticalKN,
					axialKN,
					utilization: axialKN === null ? null : axialKN / capacityKN
				});
			})
		)
	});
}

/** Vertical force balance, support reactions and per-member estimates. */
export type GravityResult = ReturnType<typeof runGravity>;
