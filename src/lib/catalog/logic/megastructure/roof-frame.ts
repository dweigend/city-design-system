import { bayMembers, bearingLayouts, crownLinks, type Joint, type Bay } from './bearing-layout';
import { roofLinks } from './roof-links';
import { selectConnectedLayout } from './connected-layouts';
import { surveyedRoofs, type RoofCell } from './footprints';
import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
import { probeFrame } from './frame-probe';

export type { RoofCell } from './footprints';
const frameParams = defineParams({
	maxSpan: numberParam('Maximum member length', 'm', 15, [1, 50, 0.5]),
	clearance: numberParam('Roof clearance', 'm', 2, [0.5, 10, 0.25])
});
export const FRAME_DIAMETER = { main: 0.18, brace: 0.1 } as const;
type Sections = 'uniform' | 'leitstil';
function solveLayout(bays: Bay[], maxSpan: number, sections: Sections) {
	const rods: { a: Joint; b: Joint; radius: number; main: boolean }[] = [];
	const add = (a: Joint, b: Joint, main: boolean) => {
		const diameter = sections === 'uniform' ? 0.14 : FRAME_DIAMETER[main ? 'main' : 'brace'];
		rods.push({ a, b, main, radius: diameter / 2 });
	};

	for (const layout of bays) {
		for (const [head, target] of bayMembers(layout))
			add(
				head,
				target,
				layout.crown.includes(target) || (head.p[0] === target.p[0] && head.p[1] === target.p[1])
			);
	}
	for (const [i, bay] of bays.entries())
		for (const other of bays.slice(i + 1))
			for (const { a, b } of crownLinks(bay, other, maxSpan)) add(a, b, true);
	const nodes = bays.flatMap((b) => [...b.feet, ...b.crown]);
	return {
		rods,
		...probeFrame(
			nodes,
			bays.flatMap((b) => b.feet),
			rods
		)
	};
}

type RoofFrameResult =
	| { status: 'assembled'; frame: ReturnType<typeof solveLayout> }
	| { status: 'empty-survey' }
	| { status: 'no-local-bay'; roofIds: string[] }
	| { status: 'span-disconnected'; components: string[][] }
	| { status: 'incompatible-bridge-bearings' }
	| { status: 'tree-layout-unresolved' | 'incompatible-cycle-bearings'; treesTried: number };

/** Plans one connected assembly on disjoint convex footprints in meters. Returns a
 * detached frame with its load probe, or a reason. Components use sorted roof IDs.
 * A failed cyclic tree policy leaves global feasibility undecided. Invalid surveys throw. */
export function planRoofFrame(
	roofs: readonly RoofCell[],
	overrides?: ParamOverrides<typeof frameParams>,
	sections: Sections = 'uniform'
): RoofFrameResult {
	const { clearance, maxSpan } = resolveParams(frameParams, overrides);
	if (!roofs.length) return { status: 'empty-survey' };
	if (new Set(roofs.map((r) => r.id)).size !== roofs.length)
		throw new RangeError('Duplicate roof ID');
	const level = Math.max(...roofs.map((r) => r.height)) + clearance;
	const ordered = surveyedRoofs(roofs).sort((a, b) => (a.id < b.id ? -1 : 1));
	const options = ordered.map((r) => bearingLayouts(r, level, maxSpan));
	const missing = ordered.filter((_, i) => !options[i].length);
	if (missing.length) return { status: 'no-local-bay', roofIds: missing.map((r) => r.id) };
	const selection = selectConnectedLayout(
		options.map((b) => b.length),
		roofLinks(options, maxSpan)
	);
	if (selection.status === 'span-disconnected')
		return {
			status: selection.status,
			components: selection.components.map((group) => group.map((i) => ordered[i].id))
		};
	if (selection.status !== 'connected') return selection;
	return {
		status: 'assembled',
		frame: solveLayout(
			selection.choices.map((option, i) => options[i][option]),
			maxSpan,
			sections
		)
	};
}
/** Builds a roof frame with the same tagged planning and load-probe result as planRoofFrame. */
export const buildRoofFrame = planRoofFrame;
