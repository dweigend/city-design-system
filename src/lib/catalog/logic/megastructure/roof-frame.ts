import { bayMembers, bearingLayouts, crownLinks, type Joint, type Bay } from './bearing-layout';
import { connectedLayouts } from './connected-layouts';
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

/** Braces disjoint convex roofs in meters. Normalized wall order defines bearing identity. Returns detached
 * members, fixed bearings and a 1 kN/head load probe. Empty or span-disconnected layouts
 * return undefined. Malformed rings and overlapping interiors throw before the solve. */
export function buildRoofFrame(
	roofs: readonly RoofCell[],
	overrides?: ParamOverrides<typeof frameParams>
) {
	const { clearance, maxSpan } = resolveParams(frameParams, overrides);
	if (!roofs.length) return;
	if (new Set(roofs.map((r) => r.id)).size !== roofs.length)
		throw new RangeError('Duplicate roof ID');
	const level = Math.max(...roofs.map((r) => r.height)) + clearance;
	const options = surveyedRoofs(roofs)
		.sort((a, b) => (a.id < b.id ? -1 : 1))
		.map((roof) => bearingLayouts(roof, level, maxSpan));
	if (options.some((bays) => !bays.length)) return;
	let failed: ReturnType<typeof solveLayout> | undefined;
	for (const bays of connectedLayouts(options, maxSpan)) {
		const result = solveLayout(bays, maxSpan);
		if (result.analysis.status === 'ok') return result;
		failed ??= result;
	}
	return failed;
}
