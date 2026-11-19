import { STORY } from '../data/grid';
import type { Vec3 } from '../logic/parametrik/types';
import type { Tool, World } from '../logic/sandbox';

export type StrokeRelease = Readonly<{ base: World; tool: Tool; cellIds: readonly string[] }>;

export type Completion = Readonly<{
	kind: Tool['kind'] | 'advance';
	before: World;
	after: World;
	cellIds: readonly string[];
}>;

function moduleCenters(cell: World['grid']['cells'][number], first: number, count: number): Vec3[] {
	const [x, y] = cell.center;
	return Array.from({ length: count }, (_, index) => [
		x,
		y,
		cell.pad + (first + index + 0.5) * STORY
	]);
}

/** Centers of modules that moved to the store, in world meters before the edit. */
export function storedModules({ before, after }: Completion): Vec3[] {
	return [...before.state.stacks].flatMap(([id, stack]) => {
		const first = after.state.stacks.get(id)?.length ?? 0;
		const cell = before.grid.cellsById.get(id);
		return cell ? moduleCenters(cell, first, stack.length - first) : [];
	});
}
