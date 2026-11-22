<script module lang="ts">
	export const lead =
		'The book begins in an invented valley, where a river shapes the ground for everything that follows and one typeface labels it.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { Valley, valleyParams } from '../../lib/domain/valley';
	import { clipPolylineToSquare, measureRiver } from '../../lib/domain/river-metrics';
	import { projectValley } from '../../lib/scene/valley-projection';
	import { StageView } from '../../lib/scene/stage-view';
	import type { View } from '../../lib/scene/stage';
	import { Button } from '../../lib/ui/button';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/landscape');
	const seeds = [1201, 1301, 1409];
	const regionalWindow = 8000;
	const { label, min, max, step, default: defaultSinuosity } = valleyParams.sinuosity;
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	let seedIndex = $state(0);
	const seed = $derived(seeds[seedIndex]);
	const querySinuosity = $derived(
		Number(page.url.searchParams.get('sinuosity') ?? defaultSinuosity)
	);
	let sinuosity = $derived(
		Number.isFinite(querySinuosity)
			? Math.min(max, Math.max(min, Number(querySinuosity.toFixed(2))))
			: defaultSinuosity
	);
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');

	function prepareValley(seed: number, sinuosity: number) {
		const start = performance.now();
		const valley = Valley.create({ seed, parameters: { sinuosity } });
		const generated = performance.now();
		const projection = projectValley(valley);
		const projected = performance.now();
		const { course } = valley;
		const reach = clipPolylineToSquare(course.xy, regionalWindow);
		if (!reach) throw new Error('The river must cross the regional window');
		return {
			...projection,
			metrics: measureRiver({ ...course, xy: reach.xy }, course.xy),
			generationMs: generated - start,
			projectionMs: projected - generated
		};
	}

	const model = $derived(prepareValley(seed, sinuosity));

	function nextValley() {
		seedIndex = (seedIndex + 1) % seeds.length;
	}

	function selectView(value: string) {
		view = value === 'plan' ? 'plan' : 'iso';
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section
	class="grid grid-aside"
	aria-label="River valley"
	data-generation-ms={model.generationMs.toFixed(2)}
	data-projection-ms={model.projectionMs.toFixed(2)}
	data-triangles={model.triangleCount}
>
	<StageView
		drawables={model.drawables}
		{view}
		display="normal"
		label="Relief map of the river valley with its floodplain, terraces and slopes"
		landscape
	/>
	<div class="stack">
		<div class="stack">
			<p>
				The river cuts its course through the valley, leaving a floodplain below and terraces along
				the slopes.
			</p>
			<p>The first settlement, its paths and the city that follows all stand on that ground.</p>
			<p>
				The same typeface names the river, marks elevations on the map and labels the controls in
				the game.
			</p>
		</div>
		<Slider {label} {min} {max} {step} bind:value={sinuosity} />
		<div class="cluster valley-controls">
			<Button label="New valley" onclick={nextValley} />
			<span class="data">Seed {seed}</span>
			<ToggleGroup label="View" items={views} bind:value={() => view, selectView} />
		</div>
		<div class="stack valley-observations">
			<p class="caption">8 km reach · 2 km shown</p>
			<dl class="data">
				<div>
					<dt>Sinuosity</dt>
					<dd>{model.metrics.sinuosity.toFixed(3)}</dd>
				</div>
				<div>
					<dt>River length</dt>
					<dd>{(model.metrics.riverLength / 1000).toFixed(3)}&nbsp;km</dd>
				</div>
				<div>
					<dt>Valley length</dt>
					<dd>{(model.metrics.valleyLength / 1000).toFixed(3)}&nbsp;km</dd>
				</div>
			</dl>
		</div>
	</div>
</section>
