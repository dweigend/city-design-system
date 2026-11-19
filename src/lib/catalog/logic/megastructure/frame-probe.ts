import { kantenId, type Vec3 } from '../traeger';
import { loeseFachwerk, rohr, STAHL, type Fachwerk } from '../statik';

type Node = { id: string; p: Vec3 };
type Rod = { a: Node; b: Node; radius: number };

/** Pins the surveyed bearings and applies the K2 1 kN gravity probe at every free joint. */
export function probeFrame(nodes: Node[], bearings: Node[], rods: Rod[]) {
	const fixed = new Set(bearings.map((n) => n.id));
	const structure: Fachwerk = {
		knoten: nodes.map(({ id, p }) => ({ id, p })),
		staebe: rods.map(({ a, b, radius }) => ({
			id: kantenId(a.id, b.id),
			a: a.id,
			b: b.id,
			eModulPa: STAHL.eModulPa,
			flaecheM2: rohr(2 * radius).flaecheM2
		})),
		lager: bearings.map((n) => ({ knotenId: n.id, fest: [true, true, true] }))
	};
	const lasten = nodes
		.filter((n) => !fixed.has(n.id))
		.map((n) => ({ knotenId: n.id, kraftN: [0, 0, -1000] satisfies Vec3 }));
	const cases = [{ id: 'service-probe', lasten }];
	return { structure, cases, analysis: loeseFachwerk(structure, cases) };
}
