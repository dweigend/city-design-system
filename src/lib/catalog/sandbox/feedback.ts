import { STORY } from '../data/grid';
import { DIG_RADIUS_M } from '../data/sandbox';
import { MODULE } from '../logic/terrain-grid';
import type { Vec3 } from '../logic/parametrik/types';
import type { StrokePlan, Tool, World } from '../logic/sandbox';

export type StrokeRelease = StrokePlan;

export type Completion = Readonly<{
	kind: Tool['kind'] | 'advance';
	before: World;
	after: World;
	cellIds: readonly string[];
}>;

type Projector = {
	metersPerPixel(): number;
	project(point: Vec3): { x: number; y: number };
};

function changedBrushCell({ before, after, cellIds }: Completion) {
	return cellIds.find(
		(id) =>
			before.state.stacks.get(id) !== after.state.stacks.get(id) ||
			before.state.cover.get(id) !== after.state.cover.get(id) ||
			before.grid.cellsById.get(id) !== after.grid.cellsById.get(id)
	);
}

function changedStructureCell({ before, after }: Completion) {
	for (const [from, to] of [
		[before, after],
		[after, before]
	] as const) {
		const part = [...to.state.parts.values()].find(
			(entry) => from.state.parts.get(entry.id) !== entry
		);
		if (part) return part.anchor.cellId;
		const line = to.state.lines.find((entry) => !from.state.lines.includes(entry));
		if (line) return line.cellIds[0];
	}
}

/** Successful placement feedback, located at the committed change. */
export function placementResponse(event: Completion, view: Projector) {
	const { kind, before, cellIds } = event;
	if (kind === 'advance' || !cellIds.length) return;
	const id = changedBrushCell(event) ?? changedStructureCell(event) ?? cellIds[0];
	const cell = before.grid.cellsById.get(id);
	if (!cell) return;
	const width = (kind === 'dig' ? 2 * DIG_RADIUS_M : MODULE) / view.metersPerPixel();
	return { kind, width, ...view.project(cell.center) };
}

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
