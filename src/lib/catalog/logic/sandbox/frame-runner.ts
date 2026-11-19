import { runTicks } from '../../core/planning';
import { applyEdit, type World } from './world';
import type { PlanningControls } from './frame-state';
import { initialTimeline } from './frame-planning';

/** Forks from a committed seeded world and replans through the same advance action as the game. */
export function runFrameTimeline(
	world: World,
	count: number,
	observe?: (world: World, index: number) => Partial<PlanningControls>,
	years?: number
) {
	return runTicks(world, count, (checkpoint, i) => {
		const timeline = checkpoint.state.frameTimeline ?? initialTimeline;
		const observed = observe?.(checkpoint, i);
		const state = applyEdit(
			observed
				? {
						...checkpoint,
						state: {
							...checkpoint.state,
							frameTimeline: { ...timeline, controls: { ...timeline.controls, ...observed } }
						}
					}
				: checkpoint,
			{ kind: 'advance', years }
		);
		return { state, result: state.state.frameTimeline?.results ?? [] };
	});
}
