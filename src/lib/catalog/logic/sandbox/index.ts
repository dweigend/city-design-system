/**
 * Sandbox: the composition point of the city game. It combines terrain, grid, house brush,
 * land cover and transit lines into one world with strokes and undo. Views read worlds and
 * change sets; they never write back (PP-2).
 */
export { EMPTY_STATE, styleForYear, stylesForYear } from './state';
export { installationView } from './installation-view';
export { applyEdit, createWorld, withState, type World } from './world';
export { commit, redo, startHistory, undo } from './history';
export { changes } from './changes';
export { beginStroke, extendStroke, type Stroke, type Tool } from './stroke';
export { cursorFrame } from './cursor';
export { currentStacks, houseView } from './houses';
export { acceptanceScene } from './acceptance-scene';
export { timelineWindow } from './time-layers';
export { buildingPlots } from './building-plots';
export {
	position as installationPosition,
	type Anchor,
	type Installation
} from './installation-parts';
