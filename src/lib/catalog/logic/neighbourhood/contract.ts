import { defineParams, numberParam, resolveParams, type ParamOverrides } from '../../core/params';

/** Immutable cell snapshot. Sides follow the carrier ring, null denotes the exterior. */
export type NeighbourCell = Readonly<{
	id: string;
	district: string;
	neighbors: readonly (string | null)[];
	form: string;
	protected?: boolean;
	intent?: string;
	pending?: Readonly<{ form: string; ticks: number }>;
}>;
export type Snapshot = ReadonlyMap<string, NeighbourCell>;
export type Weights = Readonly<Record<string, number>>;
export type Policy = Readonly<{
	contacts: Readonly<Record<string, readonly string[]>>;
	/** A conversion to this form needs at least one listed current neighbour form. */
	sources?: Readonly<Record<string, readonly string[]>>;
	city?: Weights;
	districts?: Readonly<Record<string, Weights>>;
}>;

export const neighbourhoodParams = defineParams({
	delay: numberParam('Conversion delay', 'ticks', 2, [1, 1024, 1], 'integer'),
	budget: numberParam('Candidate budget per cell', 'forms', 16, [0, 256, 1], 'integer')
});
export type Options = ParamOverrides<typeof neighbourhoodParams>;

function weights(input: Weights, forms: ReadonlySet<string>) {
	const entries = Object.entries(input);
	for (const [form, weight] of entries) {
		if (
			!forms.has(form) ||
			!Number.isFinite(weight) ||
			weight < 0 ||
			weight > 1e6 ||
			(weight > 0 && weight < 1e-6)
		)
			throw new RangeError('Invalid form weight: ' + form);
	}
	return new Map(entries);
}

/** Compiles detached lookup tables. Missing weights inherit one, missing contacts forbid a pair. */
export function compile(policy: Policy, options?: Options) {
	const forms = Object.keys(policy.contacts).sort();
	const vocabulary = new Set(forms);
	if (!forms.length || vocabulary.has('')) throw new RangeError('Expected named forms');
	const contacts = new Map(
		forms.map((form) => {
			const list = policy.contacts[form];
			if (list.some((other) => !vocabulary.has(other))) throw new RangeError('Unknown contact');
			return [form, new Set(list)] as const;
		})
	);
	const sources = new Map(
		Object.entries(policy.sources ?? {}).map(([form, list]) => {
			if (!vocabulary.has(form) || list.some((other) => !vocabulary.has(other)))
				throw new RangeError('Unknown growth source');
			return [form, new Set(list)] as const;
		})
	);
	const districts = new Map(
		Object.entries(policy.districts ?? {}).map(
			([id, values]) => [id, weights(values, vocabulary)] as const
		)
	);
	const accepts = (a: string, b: string) => !!(contacts.get(a)?.has(b) && contacts.get(b)?.has(a));
	return {
		...resolveParams(neighbourhoodParams, options),
		forms,
		vocabulary,
		accepts,
		sources,
		city: weights(policy.city ?? {}, vocabulary),
		districts
	};
}
export type Rules = ReturnType<typeof compile>;

export type Veto =
	| { form: string; reason: 'city' | 'district' | 'growth-source' }
	| { form: string; reason: 'contact'; neighbour: string };
export type Decision = Readonly<{
	target: string;
	reason: 'stock' | 'budget' | 'empty-domain' | 'intent' | 'weighted' | 'conflict';
	vetoes: readonly Veto[];
	evaluated: number;
	blocker?: string;
}>;
