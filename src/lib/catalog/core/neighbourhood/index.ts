import {
	compile,
	type Decision,
	type NeighbourCell,
	type Options,
	type Policy,
	type Snapshot
} from './contract';
import { tickPatch } from './patch';
export { tickPatch };
import { decisions } from './solve';
export {
	type DistrictPreferences,
	type PreferenceSnapshot,
	type Decision,
	type NeighbourCell,
	type Options,
	type Policy,
	type Snapshot
} from './contract';

function advance(cell: NeighbourCell, decision: Decision, delay: number): NeighbourCell {
	if (cell.protected || decision.reason === 'budget') return cell;
	const { pending, ...rest } = cell;
	if (decision.target === cell.form) return pending ? rest : cell;
	const ticks = (pending?.form === decision.target ? pending.ticks : 0) + 1;
	return ticks >= delay
		? { ...rest, form: decision.target }
		: { ...rest, pending: { form: decision.target, ticks } };
}

/** Compiles detached rules for a reciprocal polygon graph. Invalid policy or queried cells throw RangeError.
 * The seed is normalized to u32. Version 1 draws once per weighted proposal, keyed by stable cell ID.
 */
export function defineRules(policy: Policy, options?: Options) {
	const rules = compile(policy, options);
	return {
		/** Returns fresh decisions in lexical ID order for exactly the queried region. */
		solve: (ids: Iterable<string>, state: Snapshot, seed: number) =>
			decisions(ids, state, rules, seed),
		/** Returns one decision with its candidate vetoes, evaluating the same halo as solve. */
		explain(id: string, state: Snapshot, seed: number): Decision {
			const [decision] = decisions([id], state, rules, seed).values();
			return {
				...decision,
				revision: rules.revision,
				preferenceStatus: rules.preferenceStatus(state.get(id)?.district ?? '')
			};
		},
		/** Advances one synchronous step and returns sparse replacements. Unchanged records stay owned by the caller. */
		tick(ids: Iterable<string>, state: Snapshot, seed: number) {
			const patch = tickPatch<NeighbourCell>();
			for (const [id, decision] of decisions(ids, state, rules, seed)) {
				const cell = state.get(id);
				if (!cell) throw new RangeError('Missing cell: ' + id);
				const next = advance(cell, decision, rules.delay);
				if (next !== cell) patch.set(id, next);
			}
			return patch;
		}
	};
}

/** Returns the surviving two-ring decision closure of edited, inserted or removed IDs.
 * Supply both snapshots for a regrid. The caller owns stock transfer for retired identities.
 */
export function affectedRegion(changed: Iterable<string>, before: Snapshot, after: Snapshot) {
	const edits = [...new Set(changed)];
	const affected = new Set(edits);
	for (const state of [before, after]) {
		let frontier = edits;
		for (let ring = 0; ring < 2; ring++) {
			frontier = [
				...new Set(
					frontier.flatMap((id) => state.get(id)?.neighbors ?? []).filter((id) => id !== null)
				)
			];
			for (const id of frontier) affected.add(id);
		}
	}
	return [...affected].filter((id) => after.has(id)).sort();
}

export { weightedForm } from './weighted';
