import { compileSeams } from '../district-frame';
import { frameSurvey } from './frame-survey';
import { rejected, type Failure } from './installation-parts';
import type { World } from './world';

/** Places compatible player intent on the surveyed frontage. A refused stroke preserves its world. */
export function frameIntent(
	world: World,
	ids: readonly string[]
): { draft: World; failure?: Failure } {
	const cells = ids.flatMap((id) => world.grid.cellsById.get(id) ?? []);
	const selected = new Set(ids);
	const survey = frameSurvey(world);
	const intents = new Map(world.state.frameIntents);
	const touched = [...survey.seams.values()].filter((s) => s.houses.some((id) => selected.has(id)));
	const requested = new Map(survey.seams);
	for (const s of touched) requested.set(s.id, { ...s, intent: 'main' });
	const decisions = compileSeams(requested.values()).solve(
		touched.map((s) => s.id),
		world.state.frameBays ?? new Map(),
		world.seed
	);
	let reason = 'no-frame-edge';
	for (const [id, decision] of decisions) {
		if (decision.reason === 'intent' && decision.role === 'main')
			intents.set(id, 'main');
		else reason = decision.reason;
	}
	if (![...intents].some(([id,role])=>world.state.frameIntents?.get(id)!==role)) {
		const proposal = rejected(reason, cells);
		return { draft: world, ...('failure' in proposal ? { failure: proposal.failure } : {}) };
	}
	return { draft: { ...world, state: { ...world.state, frameIntents: intents } } };
}
