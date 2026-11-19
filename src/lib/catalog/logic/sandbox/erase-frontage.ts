import { frameSurvey } from './frame-survey';
import type { World } from './world-contract';
import { faceSeam } from '../district-frame';
import type { TerrainCell } from '../terrain-grid';
import type { SandboxState } from './state';
import { removeInstallations } from './installation-record';

/** Erases one frontage and retires its goals and dated reservations in the same edit. */
export function eraseFrontage(world: World, state: SandboxState, cell: TerrainCell) {
	const keys = frontages(world, state, cell);
	const timeline = state.frameTimeline;
	const removed =
		timeline?.goals.filter(
			(g) => g.houses.includes(cell.id) || [g.literal, ...g.alternatives].some((id) => keys.has(id))
		) ?? [];
	const reserved = timeline?.controls.observations.some((o) => keys.has(o.seam));
	if (!removed.length && !reserved && ![...keys].some((id) => state.frameBays?.has(id))) return;
	const frameIntents = new Map(state.frameIntents),
		frameBays = new Map(state.frameBays),
		frameInstallations = new Map(state.frameInstallations);
	for (const goal of removed)
		for (const id of [goal.literal, ...goal.alternatives]) frameIntents.delete(id);
	for (const key of keys) {
		frameIntents.set(key, 'gap');
		frameBays.delete(key);
		frameInstallations.delete(key);
	}
	const retired = new Set(removed.map((g) => g.id));
	return {
		...removeInstallations(
			state,
			(p) => p.kind === 'segment' && !!p.frame && keys.has(p.frame.seam)
		),
		frameBays,
		frameInstallations,
		frameIntents,
		frameTimeline: timeline && {
			...timeline,
			goals: timeline.goals.filter((g) => !retired.has(g.id)),
			results: timeline.results.filter((r) => !retired.has(r.goal)),
			controls: {
				...timeline.controls,
				observations: timeline.controls.observations.filter((o) => !keys.has(o.seam))
			}
		}
	};
}

function frontages(world: World, state: SandboxState, cell: TerrainCell) {
	const keys = new Set(cell.vertexIds.map((_, i) => faceSeam(cell, i).id));
	if (state.frameTimeline || state.frameBays?.size) {
		for (const seam of frameSurvey(world).seams.values()) {
			if (seam.gate && seam.houses.includes(cell.id)) keys.add(seam.id);
		}
	}
	return keys;
}
