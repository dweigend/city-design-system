import { faceSeam } from '../district-frame';
import { frameSurvey } from './frame-survey';
import { initialTimeline } from './frame-planning';
import type { Failure } from './installation-parts';
import type { World } from './world';

/** Interprets a painted frontage as a persistent frame goal. Alternatives stay on painted parcels. */
export function frameIntent(
	world: World,
	ids: readonly string[]
): { draft: World; failure?: Failure } {
	const first = world.grid.cellsById.get(ids[0]);
	if (!first) return { draft: world };
	const selected = new Set(ids),
		survey = frameSurvey(world);
	const touched = [...survey.seams.values()]
		.filter((s) => s.houses.some((h) => selected.has(h)))
		.sort(
			(a, b) =>
				Number(b.houses.includes(first.id)) - Number(a.houses.includes(first.id)) ||
				Number(b.use === 'court' || b.use === 'shore') -
					Number(a.use === 'court' || a.use === 'shore') ||
				(a.id < b.id ? -1 : 1)
		);
	const literal = touched[0]?.id ?? faceSeam(first, 0).id;
	const alternative = touched
		.slice(1)
		.find((s) => !s.opening && s.vertices.some((v) => touched[0]?.vertices.includes(v)));
	const base = world.state.frameTimeline ?? initialTimeline;
	const goal = {
		id: 'stroke/' + world.state.nextAction,
		literal,
		alternatives: alternative ? [alternative.id] : [],
		houses: [...selected],
		created: base.tick
	};
	const timeline = { ...base, goals: [...base.goals, goal] };
	return {
		draft: {
			...world,
			state: { ...world.state, nextAction: world.state.nextAction + 1, frameTimeline: timeline }
		}
	};
}
