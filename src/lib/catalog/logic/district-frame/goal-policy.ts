import type { BaySnapshot } from './seams';
import type { FrameGoal, FrameEvent, PlanningContext } from './planning-contract';

/** Scores one simulated date. Recent work favours continuity; a scheduled opening charges
 * occupied frontage for every affected tick. Utility is dimensionless and never alters eligibility.
 */
export function goalPolicy(
	goal: FrameGoal,
	history: readonly FrameEvent[],
	observations: PlanningContext['observations']
) {
	const ids = [goal.literal, ...goal.alternatives.slice(0, 1)];
	const recent = new Map<string, number>();
	for (const e of history) recent.set(e.seam, (recent.get(e.seam) ?? 0) + 1);
	const weightOf = (state: BaySnapshot, id: string) => {
		const bay = state.get(id);
		if (bay?.built) return 2;
		return bay?.pending ? 0.25 : 0;
	};
	return (state: BaySnapshot, tick: number, action: string | null) => {
		let progress = 0,
			continuity = 0,
			opening = 0;
		for (const id of new Set(ids)) {
			const weight = weightOf(state, id);
			if (!weight) continue;
			if (observations.some((o) => o.seam === id && o.from <= tick)) {
				opening -= 16 * weight;
				continue;
			}
			progress += (id === goal.literal ? 4 : 3) * weight;
			if (history.at(-1)?.seam === id)
				continuity += (2 + Math.min(2, recent.get(id) ?? 0)) * weight;
		}
		return { progress, continuity, opening, effort: action ? -0.1 : 0 };
	};
}
