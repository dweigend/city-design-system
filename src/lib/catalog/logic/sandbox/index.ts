/**
 * Sandbox: the composition point of the city game. It combines terrain, grid, house brush,
 * land cover and transit lines into one world with strokes and undo. Views read worlds and
 * change sets; they never write back (PP-2).
 */
export { EMPTY_STATE, styleForYear, stylesForYear } from './state';
export { installationPartView, installationView } from './installation-view';
export {
	prepareAdvance,
	applyEdit,
	createWorld,
	setFutureTarget,
	withState,
	type World
} from './world';
export { commit, redo, startHistory, undo } from './history';
export { changes } from './changes';
export {
	applyStroke,
	beginStroke,
	extendStroke,
	planStroke,
	traceStroke,
	type Stroke,
	type StrokePlan,
	type Tool
} from './stroke';
export {
	cursorFrame,
	cursorTarget,
	previewStrokePlan,
	strokePreview,
	tracePreview
} from './cursor';
export { currentStacks, houseView, houseGroups } from './houses';
export { acceptanceScene, openingScene } from './acceptance-scene';
export { timelineWindow } from './time-layers';
export { frameSurvey } from './frame-survey';
export { frameReport } from './frame-report';
export { runFrameTimeline } from './frame-runner';
export { createFrameStudy } from './frame-study';
export { sizeFrameSites } from './frame-sizing';
export { TWO_SUNS_MAST, TWO_SUNS_PERIOD_S, TWO_SUNS_TURNING_DISC } from './two-suns';
