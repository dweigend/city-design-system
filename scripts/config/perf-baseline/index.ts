import { defineSettings, joinSettings } from '../../../src/config/setting';

function limit(value: number, unit: string, meaning: string, rationale: string) {
	return { value, unit, meaning, rationale, bounds: { exclusiveMin: 0 } };
}

const time = (value: number, meaning: string, rationale: string) =>
	limit(value, 'ms', meaning, rationale);

const calls = (value: number, meaning: string) =>
	limit(value, 'calls/frame', meaning, 'Keeps draw submissions proportional to the visible tiles.');
const packs = (value: number, meaning: string) =>
	limit(
		value,
		'packs',
		meaning,
		'Allows for variations in queue publication cadence while bounding tile rebuilds.'
	);

/** Hard ceilings for the reference machine and the workloads documented in scripts/README.md. */
export const budgets = defineSettings({
	perfTownPipeline: time(
		24_000,
		'Town pipeline wall time.',
		'Allows roughly twice the reference time for the full town build.'
	),
	perfLargestPipeline: time(
		48_000,
		'Largest city pipeline wall time.',
		'Allows roughly twice the reference time including ground movement and lattice construction.'
	),
	perfTownPipelineRss: limit(
		1_100,
		'MiB',
		'Town pipeline peak RSS.',
		'Allows roughly twice the reference RSS while keeping the town pipeline small.'
	),
	perfLargestPipelineRss: limit(
		2_600,
		'MiB',
		'Largest city pipeline peak RSS.',
		'Allows roughly twice the reference RSS with room for the harness inside the 4 GiB slot.'
	),
	perfCityFirstFrame: time(
		7_000,
		'City navigation to first submission.',
		'Bounds the interactive cost of initial terrain and plan preparation.'
	),
	perfStudyFirstFrame: time(
		6_500,
		'Architecture study navigation to first submission.',
		'Bounds opening the fixed two-block and hall study.'
	),
	perfWholeTownFirstFrame: time(
		22_000,
		'Architecture Whole Town navigation to first submission.',
		'Allows roughly twice the reference time for the full geometry and shader setup.'
	),
	perfSandboxFirstFrame: time(
		4_500,
		'Sandbox navigation to first submission.',
		'Bounds the delay opening the editable town.'
	),
	perfPanFrame: time(
		36,
		'Sandbox pan frame interval p95.',
		'Allows two refresh periods of headroom around the reference interaction.'
	),
	perfZoomFrame: time(
		70,
		'Sandbox wheel zoom frame interval p95.',
		'Allows roughly twice the reference interval with dispatched wheel input.'
	),
	perfHoverFrame: time(
		36,
		'Sandbox parcel hover frame interval p95.',
		'Allows a missed refresh without losing responsive hover feedback.'
	),
	perfPaintFrame: time(
		150,
		'Paint gesture and queue drain frame interval p95.',
		'Allows tile repacks while bounding the tail of the stroke.'
	),
	perfArchitectureFrame: time(
		100,
		'Whole Town keyboard navigation frame interval p95.',
		'Allows roughly twice the reference interval for the full-town draw.'
	),
	perfPanCpu: time(
		2,
		'Sandbox pan stage CPU p95.',
		'Bounds camera and renderer submission work while allowing sub-millisecond timing variation.'
	),
	perfZoomCpu: time(
		2,
		'Sandbox zoom stage CPU p95.',
		'Bounds camera and renderer submission work while allowing sub-millisecond timing variation.'
	),
	perfHoverCpu: time(
		3,
		'Sandbox hover stage CPU p95.',
		'Allows outline updates with a small margin for renderer submission variance.'
	),
	perfPaintCpu: time(
		5,
		'Sandbox paint stage CPU p95.',
		'Allows for incremental repacks and submission variance during a stroke.'
	),
	perfArchitectureCpu: time(
		10,
		'Whole Town stage CPU p95.',
		'Allows roughly twice the reference submission cost for the full town.'
	),
	perfStroke: time(
		2_500,
		'Pointer-down through the final rendered stroke.',
		'Allows roughly twice the reference gesture and queue drain time.'
	),
	perfUndo: time(
		100,
		'Undo action to its completed stage frame.',
		'An edit reversal should respond within a tenth of a second.'
	),
	perfSmallLoad: time(
		2_400,
		'Opening and rendering the small save.',
		'Allows roughly twice the reference queue drain time.'
	),
	perfTownLoad: time(
		10_000,
		'Opening and rendering the full-town save.',
		'Allows roughly twice the reference full-town queue drain time.'
	),
	perfPaintCalls: calls(40, 'Draw calls on the final paint frame.'),
	perfArchitectureCalls: calls(410, 'Draw calls during Whole Town navigation.'),
	perfSmallLoadCalls: calls(45, 'Draw calls on the final small-load frame.'),
	perfTownLoadCalls: calls(85, 'Draw calls on the final town-load frame.'),
	perfPaintPacks: packs(85, 'Tile rebuilds during the paint stroke.'),
	perfSmallLoadPacks: packs(90, 'Tile rebuilds during the small load.'),
	perfTownLoadPacks: packs(420, 'Tile rebuilds during the town load.'),
	perfPaintHeap: limit(
		120,
		'MiB',
		'Sandbox JavaScript heap used after collection following the stroke.',
		'Allows growth while keeping the interactive brush heap small.'
	),
	perfArchitectureHeap: limit(
		440,
		'MiB',
		'Whole Town JavaScript heap used after collection.',
		'Leaves room for native scene buffers and the GPU driver.'
	),
	perfSmallLoadHeap: limit(
		160,
		'MiB',
		'JavaScript heap used after collection following the small load.',
		'Bounds retained data for the small save.'
	),
	perfTownLoadHeap: limit(
		320,
		'MiB',
		'JavaScript heap used after collection following the town load.',
		'Leaves space for the other Chrome processes and native geometry.'
	),
	perfSandboxRss: limit(
		2_250,
		'MiB',
		'Peak sampled combined Chrome RSS during sandbox editing.',
		'Allows roughly twice the observed RSS for the stage and processes.'
	),
	perfArchitectureRss: limit(
		2_800,
		'MiB',
		'Peak sampled combined Chrome RSS during Whole Town navigation.',
		'Leaves headroom for Vite and Bun even with shared pages counted by each Chrome process.'
	),
	perfSmallLoadRss: limit(
		2_350,
		'MiB',
		'Peak sampled combined Chrome RSS during the small load.',
		'Allows roughly twice the reference RSS while reserving capacity for Vite.'
	),
	perfTownLoadRss: limit(
		2_780,
		'MiB',
		'Peak sampled combined Chrome RSS during the town load.',
		'Allows roughly twice the reference RSS while reserving capacity for Vite.'
	)
});

/** Workload sizes and regression allowances used by the performance command. */
export const protocol = defineSettings({
	perfLargestSampleBlocks: limit(
		200,
		'blocks',
		'Private blocks sampled in the largest city.',
		'Spreads the sample across districts while bounding house geometry work in a 4 GiB slot.'
	),
	perfSmallLoadPlacements: limit(
		300,
		'placements',
		'Saved placements in the small-load workload.',
		'Exercises more than one tile and queue publication without loading every private parcel.'
	),
	perfStrokeParcels: limit(
		30,
		'parcels',
		'Private parcels covered in the paint stroke.',
		'Exercises incremental previews, queue drain and Undo in one edit.'
	),
	perfGestureSteps: limit(
		26,
		'steps',
		'Driven stage submissions in each navigation or hover gesture.',
		'Produces 25 intra-gesture intervals and keeps gestures short.'
	),
	perfGestureRepeats: limit(
		4,
		'gestures',
		'Independent repeats for each driven navigation or hover workload.',
		'Four short gestures provide at least 100 intervals for nearest-rank p99.'
	),
	perfRegressionRatio: limit(
		1.5,
		'ratio',
		'Maximum reference multiplier for timing and rendering work.',
		'Catches regressions before a hard ceiling while allowing variation on the shared host.'
	),
	perfTimeNoiseFloor: time(
		30,
		'Minimum absolute wall-time regression allowance.',
		'Absorbs a refresh or protocol scheduling delay in fast actions such as Undo.'
	),
	perfFrameNoiseFloor: time(
		17,
		'Minimum absolute p95 interval regression allowance.',
		'Allows a refresh-period change in input and stage observation cadence.'
	),
	perfCpuNoiseFloor: time(
		1,
		'Minimum absolute p95 submission regression allowance.',
		'Ignores small timing changes in sub-millisecond CPU submissions.'
	),
	perfCallNoiseFloor: limit(
		2,
		'calls/frame',
		'Minimum absolute draw-call regression allowance.',
		'Allows minor differences in the active tiles without losing sensitivity to batching regressions.'
	),
	perfPackNoiseFloor: limit(
		8,
		'packs',
		'Minimum absolute tile-pack regression allowance.',
		'Allows modest differences in queue publication between runs.'
	)
});

export const settings = joinSettings(budgets, protocol);
