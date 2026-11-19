import type { compileSeams, BaySnapshot } from './seams';
import type { Admission } from './planning-contract';

type Clock = { tick: number; year: number };

/** Resolves maturity and physical support simultaneously on the frozen input, then restricts the patch. */
export function transition(
	rules: ReturnType<typeof compileSeams>,
	region: string[],
	prior: BaySnapshot,
	seed: number,
	date: number | Clock,
	admit: Admission
) {
	const clock = typeof date === 'number' ? { tick: date, year: date } : date;
	const rejected = new Set<string>();
	const patch = rules.tick(region, prior, seed, clock.tick, clock.year, admit, rejected);
	const state = new Map(prior);
	for (const [id, bay] of patch) state.set(id, bay);
	return { state, rejected };
}
