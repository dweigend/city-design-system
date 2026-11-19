import { defineRules, type NeighbourCell } from '../../core/neighbourhood';

/** Collapses a surveyed domain against one protected upper-layer decision. Draws are addressed by layer and site. */
export function collapse<T extends string>(
	id: string,
	seed: number,
	boundary: string,
	choices: readonly (readonly [T, number])[]
): T {
	const weights = Object.fromEntries(choices.filter(([, weight]) => weight > 0));
	const forms = Object.keys(weights);
	if (!forms.length) throw new RangeError('Empty house grammar domain at ' + id);
	const fixed = 'boundary:' + boundary;
	const contacts = { ...Object.fromEntries(forms.map((f) => [f, [fixed]])), [fixed]: forms };
	const state = new Map<string, NeighbourCell>([
		[id, { id, form: forms[0], district: 'site', neighbors: ['fixed', null, null] }],
		[
			'fixed',
			{
				id: 'fixed',
				form: fixed,
				protected: true,
				district: 'boundary',
				neighbors: [id, null, null]
			}
		]
	]);
	const rules = defineRules(
		{ contacts, districts: { site: { ...weights, [fixed]: 0 } } },
		{ budget: forms.length + 1 }
	);
	const result = rules.solve([id], state, seed).get(id);
	const chosen = choices.find(([form]) => form === result?.target);
	if (!chosen || result?.reason !== 'weighted')
		throw new RangeError('Unresolved house grammar at ' + id);
	return chosen[0];
}
