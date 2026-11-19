import type { compileSeams, BaySnapshot } from './seams';
import type { Admission } from './planning-contract';

/** Advances admissible bays from one frozen survey, retaining prior stock on physical rejection. */
export function transition(
	rules: ReturnType<typeof compileSeams>,
	region: string[],
	prior: BaySnapshot,
	seed: number,
	tick: number,
	admit: Admission
) {
	const patch = rules.tick(region, prior, seed, tick);
	const decisions = rules.solve(rules.affected(region), prior, seed);
	const rejected = new Set<string>();
	for (const [id, bay] of patch) {
		if (bay.built && bay.built !== prior.get(id)?.built && !admit(id, decisions)) {
			patch.delete(id);
			rejected.add(id);
		}
	}
	return { state: new Map([...prior, ...patch]), decisions, rejected };
}
