import { required } from '../required';
import { defineRules, type NeighbourCell } from '../../core/neighbourhood';
import type { EnsembleDistrict } from './ensemble-policy';

export type LinkKind = 'skyway' | 'stair-bridge' | 'platform';
type Form = LinkKind | 'deck' | 'pending';
type Node = { id: string; choices: readonly Form[] };
const forms: Form[] = ['skyway', 'platform', 'stair-bridge', 'deck', 'pending'];
const links: Form[] = ['skyway', 'stair-bridge', 'platform'];
const contacts = Object.fromEntries(
	forms.map((form) => [
		form,
		forms.filter((other) => (links.includes(form) ? other === 'deck' : true))
	])
);
const preferences: Record<EnsembleDistrict, Partial<Record<Form, number>>> = {
	bank: { skyway: 3 },
	slope: { 'stair-bridge': 3 },
	infill: {}
};

/** Collapses a vertical section in order, or a lateral span between two fixed deck nodes.
 * Each node has its surveyed candidate domain. Null sides face the exterior. */
function solveHouseSection(nodes: Node[], district: EnsembleDistrict, seed: number): Form[] {
	const state = new Map<string, NeighbourCell>();
	const domains = Object.fromEntries(
		nodes.map(({ id, choices }, i) => {
			state.set(id, {
				id,
				district: id,
				form: choices.length === 1 ? choices[0] : 'pending',
				neighbors: [nodes[i - 1]?.id ?? null, nodes[i + 1]?.id ?? null, null],
				protected: true
			});
			return [
				id,
				Object.fromEntries(
					forms.map((f) => [f, choices.includes(f) ? (preferences[district][f] ?? 1) : 0])
				)
			];
		})
	);
	const rules = defineRules({ contacts, districts: domains }, { budget: forms.length });
	return nodes.map(({ id }) => {
		const cell = required(state.get(id), 'section node');
		state.set(id, { ...cell, protected: false });
		const form = required(rules.solve([id], state, seed).get(id), 'section decision')
			.target as Form;
		state.set(id, { ...cell, form });
		return form;
	});
}

/** Both fixed endpoint nodes must present a surveyed deck to the span node. */
export function bridgeForm(
	a: string,
	b: string,
	id: string,
	choices: LinkKind[],
	district: EnsembleDistrict,
	seed: number
) {
	return solveHouseSection(
		[
			{ id: a, choices: ['deck'] },
			{ id, choices },
			{ id: b, choices: ['deck'] }
		],
		district,
		seed
	)[1] as LinkKind;
}
