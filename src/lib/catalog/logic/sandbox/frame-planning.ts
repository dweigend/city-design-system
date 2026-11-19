import {
	planGoal,
	type Forecast,
	type FrameSeam,
	type FrameRole,
	type BayState
} from '../district-frame';
import type { FrameInstallation } from './frame-state';
import type { frameSurvey } from './frame-survey';
import type { World } from './world-contract';

type Survey = ReturnType<typeof frameSurvey>;
import type { FrameTimeline, FrameTick } from './frame-state';
export const initialTimeline: FrameTimeline = {
	tick: 0,
	goals: [],
	events: [],
	results: [],
	controls: { lookahead: 2, lookback: 2, observations: [] }
};

/** Compiles local forecasts for persistent strokes. Newer overlapping strokes own their shared seam. */
export function planFrames(
	world: World,
	survey: Survey,
	timeline: FrameTimeline,
	year: number,
	proofs: ReadonlyMap<string, FrameInstallation>
) {
	const tick = timeline.tick + 1,
		stock = world.state.frameBays ?? new Map<string, BayState>();
	const intents = new Map<string, FrameRole>(),
		plans: Forecast[] = [];
	const owners = new Map<string, string>();
	for (const goal of timeline.goals)
		for (const id of [goal.literal, ...goal.alternatives]) owners.set(id, goal.id);
	const context = {
		...timeline.controls,
		tick,
		year,
		yearsPerTick: year - world.state.year,
		events: timeline.events
	};
	const reserved = context.observations.filter((o) => o.from <= tick);
	const candidates = [...survey.seams.values()];
	for (const goal of timeline.goals) {
		const edges = candidates.map((s) =>
			owners.has(s.id) && owners.get(s.id) !== goal.id ? { ...s, opening: 'other-stroke' } : s
		);
		const plan = planGoal(
			goal,
			edges,
			stock,
			world.seed,
			context,
			(id) => proofs.get(id)?.result.status === 'sized'
		);
		plans.push(plan);
		for (const id of [goal.literal, ...goal.alternatives])
			if (owners.get(id) === goal.id) intents.set(id, plan.phases[0].seam === id ? 'main' : 'gap');
	}
	const seams = candidates.map((s): FrameSeam => ({
		...s,
		intent: intents.get(s.id) ?? s.intent,
		opening: reserved.find((o) => o.seam === s.id)?.reason ?? s.opening
	}));
	return { plans, seams, tick };
}

/** Records only observed changes at commit; forecast phases never enter the event stream. */
export function recordPlans(
	timeline: FrameTimeline,
	plans: Forecast[],
	tick: number,
	stock: ReadonlyMap<string, BayState>,
	prior: ReadonlyMap<string, BayState>
) {
	const events = timeline.events.filter((e) => e.tick >= tick - 32);
	const results = plans.map((plan): FrameTick => {
		const seam = plan.phases[0].seam;
		const ids = [
			...new Set([plan.literal, ...plan.consequences.flatMap((c) => c.stock.map((s) => s.id))])
		];
		const delta = ids.flatMap((id) => {
			const state = stock.get(id);
			return state && state !== prior.get(id) ? [{ id, state }] : [];
		});
		const applied =
			seam !== null &&
			delta.some((d) => d.id === seam && (d.state.pending === 'main' || d.state.built === 'main'));
		if (applied) events.push({ goal: plan.goal, seam, tick });
		return { ...plan, status: applied ? 'committed' : seam ? 'blocked' : 'waiting', delta };
	});
	return { ...timeline, tick, events, results };
}
