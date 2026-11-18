import { STORY } from '../../data/grid';
import { MAX_STORIES, stackTop, storiesOf } from '../house-brush';
import type { Vec3 } from '../parametrik/types';
import type { QuadCell } from '../quad-grid';
import type { SandboxState } from './state';
import type { Tool } from './stroke';

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
	return [cell.corners.map(([x, y, z]): Vec3 => [x, y, z + GROUND_LIFT])];
}
