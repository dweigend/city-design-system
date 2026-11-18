import { sandboxEpochs } from '../../data/sandbox';
import { STORY } from '../../data/grid';
import { houseChunk, type HouseUse, type Stacks } from '../house-brush';
import type { Primitive } from '../parametrik/types';
import { present, type Focus } from '../presentation';
import type { SandboxState } from './state';
import type { World } from './world';

/** Current stories retain their original floor indices for the house massing grammar. */
export function currentStacks(state: SandboxState): Stacks {
	const stacks = new Map<string, HouseUse[]>();
	for (const [id, uses] of state.stacks) {
		const current: HouseUse[] = [];
		state.storyParts.get(id)?.forEach((year, i) => {
			if (year.built === state.year) current[i] = uses[i];
		});
		if (current.length) stacks.set(id, current);
	}
	return stacks;
}

/** Projects old floors as cell masses and new floors with the house grammar. */
export function houseView(world: World, stacks: Stacks, chunk: string, focus: Focus) {
	const { grid, state, seed } = world;
	const stock: Primitive[] = [];
	for (const cell of grid.chunks.get(chunk) ?? []) {
		const count = state.storyParts.get(cell.id)?.filter((year) => year.built < state.year).length;
		if (!count) continue;
		const [cx, cy] = cell.center;
		stock.push({
			id: cell.id,
			kind: 'prism',
			role: 'bestand',
			material: 'paper',
			token: '--paper',
			polygon: cell.corners.map(([x, y]) => [cx + (x - cx) * 0.92, cy + (y - cy) * 0.92]),
			z: cell.pad,
			height: count * STORY
		});
	}
	return [
		...present(stock, focus.stock),
		...present(houseChunk(grid, stacks, chunk, seed, styleForYear(state.year)), focus.houses)
	];
}

/** Selects the newest epoch starting by the build year; earlier stock uses the oldest style. */
export function styleForYear(built: number) {
	return sandboxEpochs.findLast((epoch) => epoch.from <= built)?.style ?? sandboxEpochs[0].style;
}
