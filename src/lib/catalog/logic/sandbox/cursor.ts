import { DIG_RADIUS_M } from '../../data/sandbox';
import { routeLine } from '../transit-line';
import { editReach, terrainHeight } from '../terrain';
import { STORY } from '../../data/grid';
import { MAX_STORIES, stackTop, storiesOf } from '../house-brush';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';
import type { SandboxState } from './state';
import type { Tool } from './stroke';
import type { World } from './world';
import { propose } from './installation';
import { position, type Installation } from './installation-parts';

/** Lift of ground outlines above the terrain, meters; keeps the line readable on the surface. */
const GROUND_LIFT = 0.15;

const loopAt = (cell: QuadCell, z: number): Vec3[] => cell.corners.map(([x, y]): Vec3 => [x, y, z]);

/** Wire box between two heights: both loops and the four posts, as closed polylines. */
function wireBox(cell: QuadCell, from: number, to: number): Vec3[][] {
	const posts = cell.corners.map(([x, y]): Vec3[] => [
		[x, y, from],
		[x, y, to]
	]);
	return [loopAt(cell, from), loopAt(cell, to), ...posts];
}

/**
 * Preview of what a tool would touch on a cell, as polylines in world meters: the next story
 * as a wire box for the house brush, the top story for the eraser, the ground quad otherwise.
 */
export function cursorFrame(state: SandboxState, tool: Tool, cell: QuadCell): Vec3[][] {
	const stories = storiesOf(state.stacks, cell.id).length;
	const top = stackTop(state.stacks, cell);
	const canRaise = tool.kind === 'house' && cell.buildable && stories < MAX_STORIES;
	if (canRaise) return wireBox(cell, top, top + STORY);
	if (tool.kind === 'erase' && stories) return wireBox(cell, top - STORY, top);
	return [cursorTarget(cell)];
}

/** The one active target outline, in world meters. */
export function cursorTarget(cell: QuadCell): Vec3[] {
	return cell.corners.map(([x, y, z]) => [x, y, z + GROUND_LIFT]);
}

function digContour(world: World, [x, y]: Vec3, radius: number): Vec3[] {
	return Array.from({ length: 24 }, (_, index) => {
		const angle = (2 * Math.PI * index) / 24;
		const px = x + radius * Math.cos(angle);
		const py = y + radius * Math.sin(angle);
		return [px, py, terrainHeight(world.grid.terrain, px, py) + GROUND_LIFT];
	});
}

function basinContours(world: World, cell: QuadCell) {
	const [x, y] = cell.center;
	const reach = editReach({ kind: 'basin', center: [x, y], radius: DIG_RADIUS_M });
	return [DIG_RADIUS_M, reach].map((radius) => digContour(world, cell.center, radius));
}

function areaBoundary(world: World, cells: QuadCell[]): Vec3[][] {
	const plantable = cells.filter((cell) => cell.buildable && !world.state.stacks.has(cell.id));
	const ids = new Set(plantable.map(({ id }) => id));
	return plantable.flatMap((cell) => {
		const outline = cursorTarget(cell);
		return cell.neighbors.flatMap((id, i) =>
			id && ids.has(id) ? [] : [[outline[i], outline[(i + 1) % outline.length]]]
		);
	});
}

function walkwayMark(world: World, part: Installation): Vec3[] {
	const a = position(world.grid, part.anchor);
	if (part.kind === 'segment') return [a, position(world.grid, part.end)];
	const [x, y, z] = a;
	const d = 0.75;
	return [
		[x - d, y - d, z],
		[x + d, y - d, z],
		[x + d, y + d, z],
		[x - d, y + d, z]
	];
}

function walkwayPreview(world: World, tool: Tool, ids: readonly string[], cells: QuadCell[]) {
	const proposal = propose(world, tool, ids);
	if (proposal && 'parts' in proposal)
		return proposal.parts.map((part) => walkwayMark(world, part));
	return cells.map(cursorTarget);
}

function linePreview(
	world: World,
	tool: Extract<Tool, { kind: 'line' }>,
	ids: readonly string[],
	cells: QuadCell[]
): Vec3[][] {
	if (tool.transit === 'walkway') return walkwayPreview(world, tool, ids, cells);
	if (cells.length === 1) return [cursorTarget(cells[0])];
	const line = routeLine(world.grid, { id: 'preview', kind: tool.transit, cellIds: ids });
	const path = line?.path ?? cells.map(({ center: [x, y, z] }): Vec3 => [x, y, z + GROUND_LIFT]);
	return path.slice(1).map((point, i) => [path[i], point]);
}

/** Projects a traced gesture as detached dashed contours before any cells are committed. */
export function strokePreview(world: World, tool: Tool, ids: readonly string[]): Vec3[][] {
	const cells = ids.flatMap((id) => world.grid.cellsById.get(id) ?? []);
	if (tool.kind === 'look' || !cells.length) return [];
	if (tool.kind === 'cover') return areaBoundary(world, cells);
	if (tool.kind === 'dig') return cells.flatMap((cell) => basinContours(world, cell));
	if (tool.kind === 'line') return linePreview(world, tool, ids, cells);
	return cells.flatMap((cell) => cursorFrame(world.state, tool, cell));
}
