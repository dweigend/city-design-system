<script module lang="ts">
	export const lead =
		'The book begins in an invented valley, where a river shapes the ground for everything that follows and one typeface labels it.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { surveyValley, Valley, valleyParams } from '../../lib/domain/valley';
	import { measureRiver } from '../../lib/domain/river-metrics';
	import { projectValley } from '../../lib/scene/valley-projection';
	import type { View } from '../../lib/scene/stage';
	import { Button } from '../../lib/ui/button';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import { aspects } from './aspects';

	const chapter = chapterAt('/landscape');
	const seeds = [1201, 1301, 1409, 7, 42, 314, 2718, 9001, 65535, 424242, 31337, 8086];
	const { label, min, max, step, default: defaultSinuosity } = valleyParams.sinuosity;
	const reliefParam = valleyParams.relief;
	const runoffParam = valleyParams.runoff;
	const fit = { bearing: (28 * Math.PI) / 180, elevation: (39 * Math.PI) / 180, fill: 0.96 };
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const startSeedIndex = $derived(
		Math.max(0, seeds.indexOf(Number(page.url.searchParams.get('seed'))))
	);
	let seedIndex = $derived(startSeedIndex);
	const seed = $derived(seeds[seedIndex]);
	function clampedQuery(name: string, fallback: number, low: number, high: number) {
		const value = Number(page.url.searchParams.get(name) ?? fallback);
		return Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;
	}
	const startRelief = $derived(
		clampedQuery('relief', reliefParam.default, reliefParam.min, reliefParam.max)
	);
	const startRunoff = $derived(
		clampedQuery('runoff', runoffParam.default, runoffParam.min, runoffParam.max)
	);
	const querySinuosity = $derived(
		Number(page.url.searchParams.get('sinuosity') ?? defaultSinuosity)
	);
	const startSinuosity = $derived(
		Number.isFinite(querySinuosity)
			? Math.min(max, Math.max(min, Number(querySinuosity.toFixed(2))))
			: defaultSinuosity
	);
	const startView = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	let relief = $derived(startRelief);
	let runoff = $derived(startRunoff);
	let sinuosity = $derived(startSinuosity);
	let view = $derived(startView);

	function resetHero() {
		seedIndex = startSeedIndex;
		sinuosity = startSinuosity;
		relief = startRelief;
		runoff = startRunoff;
		view = startView;
	}

	function prepareValley(seed: number, sinuosity: number, relief: number, runoff: number) {
		const start = performance.now();
		const valley = Valley.create({ seed, parameters: { sinuosity, relief, runoff } });
		const generated = performance.now();
		const projection = projectValley(valley);
		const projected = performance.now();
		const { course } = valley;
		return {
			...projection,
			metrics: measureRiver({ ...course, xy: projection.reach }, course.xy),
			survey: surveyValley(valley),
			generationMs: generated - start,
			projectionMs: projected - generated
		};
	}

	const model = $derived(prepareValley(seed, sinuosity, relief, runoff));

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

<ChapterHeader title={chapter.title} />

<section
	class="chapter-hero"
	aria-label="River valley"
	data-generation-ms={model.generationMs.toFixed(2)}
	data-projection-ms={model.projectionMs.toFixed(2)}
	data-triangles={model.triangleCount}
>
	<ChapterViewer
		{aspects}
		onAspectStop={resetHero}
		stage={{
			drawables: model.drawables,
			view,
			display: 'normal',
			label:
				'Relief map of the river valley with its floodplain, terraces, slopes and any mountains or lake',
			landscape: true,
			fit
		}}
	>
		{#snippet controls()}
			<div class="valley-sliders">
				<Slider {label} {min} {max} {step} bind:value={sinuosity} />
				<Slider
					label={reliefParam.label}
					min={reliefParam.min}
					max={reliefParam.max}
					step={reliefParam.step}
					bind:value={relief}
				/>
				<Slider
					label={runoffParam.label}
					min={runoffParam.min}
					max={runoffParam.max}
					step={runoffParam.step}
					bind:value={runoff}
				/>
			</div>
			<div class="cluster valley-controls">
				<Button label="New terrain" onclick={nextValley} />
				<span class="data">Seed {seed}</span>
				<ToggleGroup label="View" items={views} bind:value={() => view, selectView} />
			</div>
		{/snippet}
	</ChapterViewer>
</section>

<div class="grid grid-aside chapter-notes">
	<div class="stack">
		<p class="lead">{lead}</p>
		<p>
			The river cuts its course through the valley, leaving a floodplain below and terraces along
			the slopes.
		</p>
		<p>
			Runoff gathers in tributaries and widens the river downstream. Where the ground traps water, a
			lake fills to its lowest outlet.
		</p>
		<p>The first settlement, its paths and the city that follows all stand on that ground.</p>
		<p>
			The same typeface names the river, marks elevations on the map and labels the controls in the
			game.
		</p>
	</div>
	<div class="stack">
		<a href={resolve('/landscape?seed=42&relief=1&view=plan')}>Side-lake example</a>
		<div class="stack valley-observations">
			<p class="caption">
				{(model.object.footprint.width / 1000).toFixed(1)} × {(
					model.object.footprint.depth / 1000
				).toFixed(1)}&nbsp;km
				<span class="data"> · Heights ×{model.heightScale} · Survey 4 × 4 km</span>
			</p>
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
				<div>
					<dt>Median river width</dt>
					<dd>{Math.round(model.metrics.wetWidth)}&nbsp;m</dd>
				</div>
				<div>
					<dt>Relief range</dt>
					<dd>{Math.round(model.survey.reliefM)}&nbsp;m</dd>
				</div>
				<div>
					<dt>Water share</dt>
					<dd>{(model.survey.waterShare * 100).toFixed(1)}&nbsp;%</dd>
				</div>
				<div>
					<dt>Lake area</dt>
					<dd>{(model.survey.lakeArea / 1e6).toFixed(2)}&nbsp;km²</dd>
				</div>
			</dl>
		</div>
	</div>
</div>
