import type { FlowId } from '../../data/focus';
import type { SandboxSnapshot, TimeLayer } from './state';

/** Construction flows grouped by included build year in chronological order. */
export function constructionLayers(
	state: SandboxSnapshot,
	includesYear: (year: number) => boolean
): TimeLayer[] {
	const byYear = new Map<number, Set<FlowId>>();
	function add(year: number, flow: FlowId) {
		const flows = byYear.get(year) ?? new Set();
		flows.add(flow);
		byYear.set(year, flows);
	}
	for (const [cellId, stories] of state.storyParts) {
		const uses = state.stacks.get(cellId);
		for (const { built, anchor } of stories) {
			const use = uses?.[anchor.level];
			if (use && includesYear(built)) add(built, use === 'living' ? 'people' : use);
		}
	}
	for (const { year } of state.lines) if (includesYear(year)) add(year, 'people');
	return [...byYear]
		.sort(([a], [b]) => a - b)
		.map(([year, flows]) => ({ year, flows: [...flows] }));
}
