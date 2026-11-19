import { searchSequences } from '../../core/planning';
import { seamSimulator } from './seam-simulator';
import type { BaySnapshot } from './seams';
import type { FrameSeam } from './seam-policy';
import type { FrameGoal, PlanningContext, Admission } from './planning-contract';
export type { FrameGoal, FrameEvent, PlanningContext } from './planning-contract';
type Phase = { tick: number; seam: string | null };

/** Recommends one authorized frontage action and serializable revisable phases. */
export function planGoal(
	goal: FrameGoal,
	survey: readonly FrameSeam[],
	stock: BaySnapshot,
	seed: number,
	ctx: PlanningContext,
	admit: Admission = () => true
) {
	const adapter = seamSimulator(goal, survey, seed, ctx, admit);
	const { halo, ids, history } = adapter;
	const search = searchSequences(stock, ctx.tick, adapter.domain, {
		strategy: 'beam',
		width: 4,
		budget: 96,
		...ctx.search,
		lookahead: ctx.lookahead
	});
	const literalReason = adapter.literalReason();
	const phases: Phase[] = search.steps.map((s) => ({ tick: s.tick, seam: s.action }));
	if (!phases.length) phases.push({ tick: ctx.tick, seam: null });
	const first = phases[0].seam;
	const reason =
		search.diagnostics.exhausted && !search.steps.length
			? 'budget'
			: first === goal.literal
				? 'literal'
				: literalReason !== 'intent'
					? literalReason
					: ctx.observations.some(
								(o) => o.seam === goal.literal && o.from <= ctx.tick + ctx.lookahead
						  )
						? 'forecast-opening'
						: first
							? 'continuity'
							: 'completed-or-deferred';
	return {
		tick: ctx.tick,
		goal: goal.id,
		literal: goal.literal,
		reason,
		lookback: ctx.lookback,
		history,
		observations: ctx.observations.filter((o) => o.from <= ctx.tick && halo.has(o.seam)),
		phases,
		score: search.score,
		assumptions: ctx.observations.filter((o) => o.from > ctx.tick && halo.has(o.seam)),
		consequences: search.steps.map((s) => ({
			tick: s.tick,
			contributions: s.contributions,
			stock: ids.map((id) => ({ id, ...s.state.get(id) }))
		})),
		diagnostics: search.diagnostics
	};
}
export type Forecast = ReturnType<typeof planGoal>;
