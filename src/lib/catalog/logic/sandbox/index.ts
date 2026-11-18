/**
 * Sandbox: the composition point of the city game. It combines terrain, grid, house brush,
 * land cover and transit lines into one world with strokes and undo. Views read worlds and
 * change sets; they never write back (PP-2).
 */
export { EMPTY_STATE } from './state';
export { applyEdit, createWorld, withState, type World } from './world';
export { commit, redo, startHistory, undo } from './history';
export { changes } from './changes';
export { beginStroke, extendStroke, type Stroke, type Tool } from './stroke';
export { cursorFrame } from './cursor';
