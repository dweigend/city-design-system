import { bayMembers, bearingLayouts, crownLinks, type Joint, type Bay } from './bearing-layout';
import { roofLinks } from './roof-links';
import { selectConnectedLayout } from './connected-layouts';
import { surveyedRoofs, type RoofCell } from './footprints';
import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../params';
import { kantenId, type Vec3 } from '../traeger';
import { loeseFachwerk, rohr, STAHL, type Fachwerk } from '../statik';

export type { RoofCell } from './footprints';
const frameParams = defineParams({
	maxSpan: numberParam('Maximum member length', 'm', 15, [1, 50, 0.5]),
	clearance: numberParam('Roof clearance', 'm', 2, [0.5, 10, 0.25])
});
const section = rohr(0.14);
function solveLayout(bays: Bay[], maxSpan: number) {
	const structure: Fachwerk = { knoten: [], staebe: [], lager: [] };
	const add = (a: Joint, b: Joint) =>
		structure.staebe.push({
			id: kantenId(a.id, b.id),
			a: a.id,
			b: b.id,
			eModulPa: STAHL.eModulPa,
			flaecheM2: section.flaecheM2
		});

	for (const layout of bays) {
		structure.knoten.push(...layout.feet, ...layout.crown);
		for (const [head, target] of bayMembers(layout)) add(head, target);
		for (const foot of layout.feet)
			structure.lager.push({ knotenId: foot.id, fest: [true, true, true] });
	}
	for (const [i, bay] of bays.entries())
		for (const other of bays.slice(i + 1))
			for (const { a, b } of crownLinks(bay, other, maxSpan)) add(a, b);
	const lasten = bays.flatMap(({ crown }) =>
		crown.map((n) => ({ knotenId: n.id, kraftN: [0, 0, -1000] satisfies Vec3 }))
	);
	return { structure, analysis: loeseFachwerk(structure, [{ id: 'service-probe', lasten }]) };
}

type RoofFrameResult =
	| { status: 'assembled'; frame: ReturnType<typeof solveLayout> }
	| { status: 'empty-survey' }
	| { status: 'no-local-bay'; roofIds: string[] }
	| { status: 'span-disconnected'; components: string[][] }
	| { status: 'incompatible-bridge-bearings' }
	| { status: 'tree-layout-unresolved'; treesTried: number };

/** Plans one connected assembly on disjoint convex footprints in meters. Returns a
 * detached frame with its load probe, or a reason. Components use sorted roof IDs.
 * A failed cyclic tree policy leaves global feasibility undecided. Invalid surveys throw. */
export function planRoofFrame(
	roofs: readonly RoofCell[],
	overrides?: ParamOverrides<typeof frameParams>
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
			maxSpan
		)
	};
}
/** Returns the assembled frame and its 1 kN/head load probe, or undefined when planning
 * fails. Same meters, defaults, validation and ownership as planRoofFrame. */
export function buildRoofFrame(
	roofs: readonly RoofCell[],
	overrides?: ParamOverrides<typeof frameParams>
) {
	const result = planRoofFrame(roofs, overrides);
	return result.status === 'assembled' ? result.frame : undefined;
}
