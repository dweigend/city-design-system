/**
 * Chronicle of a block for the Bible: founding, then eras with their own drivers. The same
 * operator `evolve` continues each era; existing stock is protected after the founding.
 * Pure: same input ⇒ same chronicle. Errors return a code, no partial state.
 */
import {
	byId,
	DEFAULT_RULES,
	isPublic,
	type BlockSpec,
	type DriverSpec,
	type Outcome,
	type ParcelRules,
	type ParcelState
} from './typen';
import { createBlock, parcelize } from './genese';
import { evolve } from './evolution';
import { setProtection } from './operationen';
import { CHANNEL, hashUnit } from './zufall';

export type Zeit = { treiber?: DriverSpec; schritte: number };
export type Zeitstand = {
	state: ParcelState;
	/** Parcels created or converted in this era. */
	geaendert: string[];
};

/** Founding plus every era; `schutz` private parcels become existing stock via a seed hash. */
export function chronik(
	spec: BlockSpec,
	seed: number,
	schutz: number,
	zeiten: readonly Zeit[],
	rules: ParcelRules = DEFAULT_RULES
): Outcome<Zeitstand[]> {
	const block = createBlock(spec, seed, rules);
	if (!block.ok) return block;
	const genese = parcelize(block.value, rules);
	if (!genese.ok) return genese;
	const kandidaten = genese.value.state.parcels
		.filter((p) => !isPublic(p.use))
		.sort(
			(a, b) =>
				hashUnit(seed, a.id, CHANNEL.priority) - hashUnit(seed, b.id, CHANNEL.priority) ||
				byId(a, b)
		)
		.slice(0, schutz)
		.map((p) => p.id);
	const geschuetzt = setProtection(genese.value.state, kandidaten, true);
	if (!geschuetzt.ok) return geschuetzt;
	let s = geschuetzt.value;
	const out: Zeitstand[] = [];
	for (const zeit of zeiten) {
		if (!zeit.treiber || zeit.schritte === 0) {
			out.push({ state: s, geaendert: [] });
			continue;
		}
		const weiter = evolve(s, rules, zeit.treiber, zeit.schritte);
		if (!weiter.ok) return weiter;
		const neu = weiter.value.log.slice(s.log.length);
		const geaendert = new Set(neu.filter((e) => e.kind !== 'reject').flatMap((e) => e.resultIds));
		s = weiter.value;
		out.push({
			state: s,
			geaendert: [...geaendert].filter((id) => s.parcels.some((p) => p.id === id)).sort()
		});
	}
	return { ok: true, value: out };
}
