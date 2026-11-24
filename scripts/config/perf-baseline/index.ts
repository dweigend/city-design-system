import { defineSettings } from '../../../src/config/setting';

function limit(value: number, unit: string, meaning: string, rationale: string) {
	return { value, unit, meaning, rationale, bounds: { exclusiveMin: 0 } };
}

/** Hard ceilings for the reference machine and the workloads documented in scripts/README.md. */
export const settings = defineSettings({
	perfLargestSampleBlocks: {
		value: 200,
		unit: 'blocks',
		meaning:
			'Number of evenly spaced private blocks measured for largest-city house placement and projection.',
		rationale:
			'Samples the different districts while bounding the house geometry work in a 4 GiB slot.'
	},
	perfTownPipeline: limit(
		20_000,
		'ms',
		'Town pipeline stage total.',
		'Keeps a full town rebuild within an interactive study session.'
	),
	perfLargestPipeline: limit(
		50_000,
		'ms',
		'Largest city pipeline stage total.',
		'Leaves time for the browser cases in one 600-second slot.'
	),
	perfPipelineRss: limit(
		2_800,
		'MiB',
		'Peak RSS of either Bun pipeline process.',
		'Leaves over 1 GiB of the slot for the harness and operating overhead.'
	),
	perfFirstFrame: limit(
		20_000,
		'ms',
		'Navigation to first stage submission on each route.',
		'Cold terrain, geometry and shader preparation must stay within a short preview load.'
	),
	perfPanZoomHoverFrame: limit(
		110,
		'ms',
		'Sandbox pan, zoom and hover frame interval p95.',
		'Flags sustained input feedback slower than roughly nine updates per second on the reference iGPU.'
	),
	perfPaintFrame: limit(
		180,
		'ms',
		'Paint gesture and queue drain frame interval p95.',
		'Allows tile repacks during painting while catching long stalls across the stroke.'
	),
	perfStageCpu: limit(
		35,
		'ms',
		'Stage CPU submission p95 during measured interactions.',
		'Bounds camera, style and renderer submission work per visible update.'
	),
	perfStroke: limit(
		4_000,
		'ms',
		'Pointer-down through the last rendered build of the 30-parcel stroke.',
		'Keeps immediate previews and completed geometry within one editing gesture.'
	),
	perfUndo: limit(
		1_000,
		'ms',
		'Undo action to the frame showing the restored document.',
		'An edit reversal should return control within a second.'
	),
	perfSmallLoad: limit(
		4_000,
		'ms',
		'Opening and rendering the 300-house save.',
		'Allows incremental unpacking while keeping a small save quick to reopen.'
	),
	perfTownLoad: limit(
		15_000,
		'ms',
		'Opening and rendering the 2,198-house save.',
		'Caps the full-town queue drain on the reference machine.'
	),
	perfDrawCalls: limit(
		500,
		'calls/frame',
		'Draw calls on the last frame of a measured house load or town view.',
		'Keeps the renderer on the shared tile batching path as the house count grows.'
	),
	perfTilePacks: limit(
		450,
		'packs',
		'Tile rebuilds during one sandbox file load.',
		'Allows incremental publication while catching repeated rebuilds of the same tiles.'
	),
	perfBrowserHeap: limit(
		950,
		'MiB',
		'Live JavaScript heap after a measured browser workload.',
		'Leaves room for native geometry buffers and driver allocations.'
	),
	perfBrowserRss: limit(
		2_800,
		'MiB',
		'Peak sampled combined RSS of Chrome workload processes.',
		'Leaves headroom below the 4 GiB slot even when process RSS counts shared pages repeatedly.'
	)
});
