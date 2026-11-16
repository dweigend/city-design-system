import { compile } from './model';
import { InvariantError, type Intent, type Model } from './types';
const sorted = <T>(m: ReadonlyMap<string, T>) =>
	[...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
/** Saves authority, not derived caches. Version pins the derivation algorithm. */
export function encode(model: Model): string {
	const i = model.intent;
	return JSON.stringify({
		version: 1,
		seed: i.seed,
		limits: i.limits,
		positions: sorted(i.positions),
		faces: sorted(i.faces),
		semantics: sorted(i.semantics),
		fixed: [...i.fixed].sort()
	});
}
export function decode(json: string): Model {
	const data = JSON.parse(json);
	if (data.version !== 1) throw new InvariantError('unsupported-format');
	for (const k of ['positions', 'faces', 'semantics'])
		if (!Array.isArray(data[k]) || new Map(data[k]).size !== data[k].length)
			throw new InvariantError('duplicate-or-invalid-record');
	const intent: Intent = {
		version: 1,
		seed: data.seed,
		limits: data.limits,
		positions: new Map(data.positions),
		faces: new Map(data.faces),
		semantics: new Map(data.semantics),
		fixed: new Set(data.fixed)
	};
	return compile(intent);
}
