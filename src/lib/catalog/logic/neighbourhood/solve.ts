import { hashUnit } from '../../core/random';
import type { Decision, NeighbourCell, Rules, Snapshot, Veto } from './contract';

function readCell(id: string, state: Snapshot, rules: Rules) {
	const cell = state.get(id);
	if (!cell || cell.id !== id || !rules.vocabulary.has(cell.form))
		throw new RangeError('Unknown cell or form: ' + id);
	const pending = cell.pending;
	if (
		(cell.intent !== undefined && !rules.vocabulary.has(cell.intent)) ||
		(pending &&
			(!rules.vocabulary.has(pending.form) ||
				!Number.isSafeInteger(pending.ticks) ||
				pending.ticks < 1))
	)
		throw new RangeError('Invalid development state: ' + id);
	if (cell.neighbors.length < 3 || cell.neighbors.length > 5)
		throw new RangeError('Invalid side count: ' + id);
	return cell;
}

function neighbours(cell: NeighbourCell, state: Snapshot, rules: Rules) {
	const ids = cell.neighbors.filter((id) => id !== null).sort();
	if (new Set(ids).size !== ids.length || ids.includes(cell.id))
		throw new RangeError('Invalid incidence: ' + cell.id);
	return ids.map((id) => {
		const other = readCell(id, state, rules);
		if (!other.neighbors.includes(cell.id)) throw new RangeError('Missing reciprocal side: ' + id);
		return other;
	});
}

function domain(cell: NeighbourCell, adjacent: readonly NeighbourCell[], rules: Rules) {
	const vetoes: Veto[] = [];
	const choices = [];
	let total = 0;
	for (const form of rules.forms) {
		const city = rules.city.get(form) ?? 1;
		const district = rules.districts.get(cell.district)?.get(form) ?? 1;
		const sources = rules.sources.get(form);
		const blocker = adjacent.find((other) => !rules.accepts(form, other.form));
		if (!city) vetoes.push({ form, reason: 'city' });
		else if (!district) vetoes.push({ form, reason: 'district' });
		else if (blocker) vetoes.push({ form, reason: 'contact', neighbour: blocker.id });
		else if (form !== cell.form && sources && !adjacent.some((other) => sources.has(other.form)))
			vetoes.push({ form, reason: 'growth-source' });
		else {
			total += city * district;
			choices.push({ form, end: total });
		}
	}
	return { choices, vetoes, total };
}

function propose(
	cell: NeighbourCell,
	adjacent: readonly NeighbourCell[],
	rules: Rules,
	seed: number
): Decision {
	const hold = { target: cell.form, evaluated: 0, vetoes: [] };
	if (cell.protected) return { ...hold, reason: 'stock' };
	if (rules.forms.length > rules.budget) return { ...hold, reason: 'budget' };
	const { choices, vetoes, total } = domain(cell, adjacent, rules);
	const trace = { evaluated: rules.forms.length, vetoes };
	if (!choices.length) return { ...trace, target: cell.form, reason: 'empty-domain' };
	if (cell.intent !== undefined && choices.some(({ form }) => form === cell.intent))
		return { ...trace, target: cell.intent, reason: 'intent' };
	const draw = hashUnit(seed, cell.id, 'neighbourhood-form-v1') * total;
	const choice = choices.find(({ end }) => draw < end) ?? choices[choices.length - 1];
	return { ...trace, target: choice.form, reason: 'weighted' };
}

/** Queries independent proposals in a two-ring halo and resolves contested contacts by stable ID. */
export function decisions(ids: Iterable<string>, state: Snapshot, rules: Rules, seed: number) {
	const cache = new Map<string, ReturnType<typeof inspect>>();
	function inspect(id: string) {
		const cell = readCell(id, state, rules);
		const adjacent = neighbours(cell, state, rules);
		return { cell, adjacent, proposal: propose(cell, adjacent, rules, seed) };
	}
	function at(id: string) {
		const value = cache.get(id) ?? inspect(id);
		cache.set(id, value);
		return value;
	}
	const result = new Map<string, Decision>();
	for (const id of [...new Set(ids)].sort()) {
		const { cell, adjacent, proposal } = at(id);
		const blocker =
			proposal.target !== cell.form &&
			adjacent.find(
				(other) => other.id < id && !rules.accepts(proposal.target, at(other.id).proposal.target)
			);
		result.set(
			id,
			blocker
				? { ...proposal, target: cell.form, reason: 'conflict', blocker: blocker.id }
				: proposal
		);
	}
	return result;
}
