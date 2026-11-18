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
type Joint = { id: string; p: Vec3 };
function length(a: Joint, b: Joint) {
	return Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
}
function bay(roof: RoofCell, level: number) {
	const ring = roof.polygon;
	const feet = Array.from({ length: 3 }, (_, k): Joint => {
		const i = Math.floor((k * ring.length) / 3),
			a = ring[i],
			b = ring[(i + 1) % ring.length];
		return {
			id: JSON.stringify([roof.id, k, 'foot']),
			p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, roof.height]
		};
	});
	const [a, b, c] = feet.map((n) => n.p);
	if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 1e-8)
		throw new RangeError('Collinear roof bearings');
	const crown = feet.map(({ p }, k): Joint => ({
		id: JSON.stringify([roof.id, k, 'head']),
		p: [p[0], p[1], level + (k === 1 ? 1 : 0)]
	}));
	return { feet, crown };
}
function linked(structure: Fachwerk) {
	const neighbors = new Map(structure.knoten.map((n) => [n.id, new Set<string>()]));
	for (const { a, b } of structure.staebe) {
		neighbors.get(a)?.add(b);
		neighbors.get(b)?.add(a);
	}
	const queue = [structure.knoten[0].id],
		seen = new Set(queue);
	for (const id of queue)
		for (const next of neighbors.get(id) ?? [])
			if (!seen.has(next)) {
				seen.add(next);
				queue.push(next);
			}
	return seen.size === structure.knoten.length;
}
/** Braces disjoint convex roofs in meters. Ring order defines wall identity. Returns detached
 * members, fixed bearings and a 1 kN/head load probe. Empty or span-disconnected layouts
 * return undefined. Malformed rings, interior overlap and invalid bearing stations throw before the solve. */
export function buildRoofFrame(
	roofs: readonly RoofCell[],
	overrides?: ParamOverrides<typeof frameParams>
) {
	const { clearance, maxSpan } = resolveParams(frameParams, overrides);
	if (!roofs.length) return;
	if (new Set(roofs.map((r) => r.id)).size !== roofs.length)
		throw new RangeError('Duplicate roof ID');
	const level = Math.max(...roofs.map((r) => r.height)) + clearance;
	const bays = surveyedRoofs(roofs)
		.sort((a, b) => (a.id < b.id ? -1 : 1))
		.map((r) => bay(r, level));
	const structure: Fachwerk = { knoten: [], staebe: [], lager: [] };
	const add = (a: Joint, b: Joint) =>
		structure.staebe.push({
			id: kantenId(a.id, b.id),
			a: a.id,
			b: b.id,
			eModulPa: STAHL.eModulPa,
			flaecheM2: section.flaecheM2
		});
	for (const { feet, crown } of bays) {
		structure.knoten.push(...feet, ...crown);
		for (const [i, head] of crown.entries()) {
			const targets = [...feet, crown[(i + 1) % 3]];
			if (targets.some((n) => length(n, head) > maxSpan)) return;
			targets.forEach((n) => add(head, n));
			structure.lager.push({ knotenId: feet[i].id, fest: [true, true, true] });
		}
	}
	for (const [i, bay] of bays.entries())
		for (const other of bays.slice(i + 1)) {
			const pairs = bay.crown
				.flatMap((a) => other.crown.map((b) => ({ a, b, d: length(a, b) })))
				.filter((p) => p.d > 1e-8 && p.d <= maxSpan)
				.sort((a, b) => a.d - b.d);
			if (pairs.length >= 3) pairs.slice(0, 3).forEach(({ a, b }) => add(a, b));
		}
	if (!linked(structure)) return;
	const lasten = bays.flatMap(({ crown }) =>
		crown.map((n) => ({ knotenId: n.id, kraftN: [0, 0, -1000] satisfies Vec3 }))
	);
	return { structure, analysis: loeseFachwerk(structure, [{ id: 'service-probe', lasten }]) };
}
