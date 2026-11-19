import type { FlowId } from '../../data/focus';
import type { SandboxSnapshot, TimeLayer } from './state';

function addSiteFlows(state: SandboxSnapshot, add: (built: number, flow: FlowId) => void) {
	for (const part of state.parts?.values() ?? []) if (part.flow) add(part.built, part.flow);
	for (const work of state.spongeWorks ?? []) add(work.built, 'water');
	for (const { year } of state.lines) add(year, 'people');
}

/** Construction flows grouped by included build year in chronological order. */
export function constructionLayers(
	state: SandboxSnapshot,
	includesYear: (year: number) => boolean
): TimeLayer[] {
	const byYear = new Map<number, Set<FlowId>>();
	function add(year: number, flow: FlowId) {
		if (!includesYear(year)) return;
		const flows = byYear.get(year) ?? new Set();
		flows.add(flow);
		byYear.set(year, flows);
	}
	for (const [cellId, stories] of state.storyParts) {
		const uses = state.stacks.get(cellId);
		for (const { built, anchor } of stories) {
			const use = uses?.[anchor.level];
			if (use) add(built, use === 'living' ? 'people' : use);
		}
	}
	addSiteFlows(state, add);
	return [...byYear]
		.sort(([a], [b]) => a - b)
		.map(([year, flows]) => ({ year, flows: [...flows] }));
}

/** Timeline starts at the first playable year and keeps at least four generation spans visible. */
export function timelineWindow(startYear: number, year: number, generationYears: number) {
	return {
		min: startYear,
		max: Math.max(startYear + 4 * generationYears, year + generationYears)
	};
}

/** Selects the closest committed generation to a ruler value, clamped to the playable range. */
export function timelineYear(value: number, min: number, max: number, generationYears: number) {
	const offset = Math.round((value - min) / generationYears) * generationYears;
	return Math.min(max, Math.max(min, min + offset));
}
