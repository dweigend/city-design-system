import { goalPolicy } from './goal-policy';
import { transition } from './transition';
import type { Simulator } from '../../core/planning';
import { hashUnit } from '../../core/random';
import { compileSeams, type BaySnapshot } from './seams';
import type { FrameSeam, FrameRole } from './seam-policy';
import type { FrameGoal, PlanningContext, Admission } from './planning-contract';

/** Compiles immutable local constraints for counterfactuals with the live tick and admission checks. */
export function seamSimulator(
	goal: FrameGoal,
	survey: readonly FrameSeam[],
	seed: number,
	ctx: PlanningContext,
	admit: Admission
) {
	for (const [value, max] of [
		[ctx.lookback, 32],
		[ctx.lookahead, 4]
	])
		if (!Number.isInteger(value) || value < 0 || value > max)
			throw new RangeError('Invalid planning horizon');
	const history = ctx.events.filter(
		(e) => e.goal === goal.id && e.tick < ctx.tick && e.tick >= ctx.tick - ctx.lookback
	);
	const score = goalPolicy(goal, history, ctx.observations);
	const ids = [...new Set([goal.literal, ...goal.alternatives.slice(0, 1)])];
	const options = [...ids, null].sort(
		(a, b) => hashUnit(seed, goal.id, a ?? 'wait') - hashUnit(seed, goal.id, b ?? 'wait')
	);
	const local = compileSeams(survey);
	let region = ids;
	for (let i = 0; i < ctx.lookahead + 2; i++) region = local.affected(region);
	const halo = new Set(region),
		edges = survey.filter((s) => halo.has(s.id));
	region = edges.map((s) => s.id).sort();
	const packs = new Map<string, ReturnType<typeof compileSeams>>();
	function constraints(action: string | null, tick: number) {
		const key = JSON.stringify([action, tick]);
		let rules = packs.get(key);
		if (!rules) {
			rules = compileSeams(
				edges.map((s) => {
					const opening =
						ctx.observations.find((o) => o.seam === s.id && o.from <= tick)?.reason ?? s.opening;
					const intent: FrameRole | undefined = ids.includes(s.id)
						? s.id === action
							? 'main'
							: 'gap'
						: s.intent;
					return { ...s, opening, intent };
				})
			);
			packs.set(key, rules);
		}
		return rules;
	}
	let literalReason = 'missing-frontage';

	function allowed(
		pack: ReturnType<typeof compileSeams>,
		state: BaySnapshot,
		action: string,
		tick: number
	) {
		if (!edges.some((s) => s.id === action)) return false;
		const decision = pack.solve([action], state, seed).get(action);
		if (action === goal.literal && tick === ctx.tick)
			literalReason = decision?.reason ?? 'missing-frontage';
		return decision?.role === 'main' && state.get(action)?.built !== 'main';
	}
	const domain: Simulator<BaySnapshot, string | null> = {
		choices: () => options,
		step: (state, action, tick) => {
			const pack = constraints(action, tick);
			if (action && !allowed(pack, state, action, tick)) return;
			const { state: next, rejected } = transition(
				pack,
				region,
				state,
				seed,
				{ tick, year: (ctx.year ?? ctx.tick) + (tick - ctx.tick) * (ctx.yearsPerTick ?? 1) },
				admit
			);
			if (action && rejected.has(action)) {
				if (action === goal.literal && tick === ctx.tick) literalReason = 'structural-veto';
				return;
			}
			return { state: next, contributions: score(next, tick, action) };
		}
	};
	return { domain, halo, ids, history, literalReason: () => literalReason };
}
