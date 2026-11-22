<script module lang="ts">
	export const lead =
		'The city grows from the terrain as grids, building shapes and events give it form without a master plan.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { required } from '../../lib/core/invariant';
	import { resolveParams } from '../../lib/core/params';
	import { cityVolumeParams } from '../../lib/domain/city-volume';
	import { projectCityVolume } from '../../lib/scene/city-volume-projection';
	import type { View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { terrainGridProjection } from '../../lib/scene/terrain-grid-projection';
	import { projectValleyWindow } from '../../lib/scene/valley-projection';
	import { Slider } from '../../lib/ui/slider';
	import { Tabs } from '../../lib/ui/tabs';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import { citySiteParams, createCityPlan, createCitySite } from '../../lib/world/city-site';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/city');
	const city = createCitySite();
	const heightsScale = `Heights ×${city.heightScale}`;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
	const fit = { bearing: (10 * Math.PI) / 180, elevation: (33 * Math.PI) / 180, fill: 0.98 };
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const steps = [
		{ value: '01', label: 'Plan' },
		{ value: '02', label: 'Volume' },
		{ value: '03', label: 'Heights' }
	];
	const { citySize: sizeParam } = citySiteParams;
	const { height: heightParam, complexity: complexityParam } = cityVolumeParams;

	function valueFromQuery(key: string) {
		const raw = page.url.searchParams.get(key);
		if (raw === null || raw.trim() === '') return undefined;
		const value = Number(raw);
		return Number.isFinite(value) ? value : undefined;
	}

	function stepFromQuery() {
		const value = page.url.searchParams.get('step');
		return value === '01' || value === '02' ? value : '03';
	}

	let step = $derived(stepFromQuery());
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	let citySize = $derived(
		resolveParams(citySiteParams, { citySize: valueFromQuery('city') ?? sizeParam.default })
			.citySize
	);
	const volumeInputs = $derived(
		resolveParams(cityVolumeParams, {
			height: valueFromQuery('height') ?? heightParam.default,
			complexity: valueFromQuery('complexity') ?? complexityParam.default
		})
	);
	let height = $derived(volumeInputs.height);
	let complexity = $derived(volumeInputs.complexity);
	const activeComplexity = $derived(step === '03' ? complexity : 0);

	const plan = $derived(preparePlan(citySize));
	const volume = $derived(prepareVolume(plan, height, activeComplexity));
	const drawables = $derived([
		...plan.drawables,
		...volume.drawables.map((part) => ({ ...part, visible: step !== '01' }))
	]);

	const measurements = $derived([
		{ label: 'Cells', value: plan.grid.cells.length, unit: '' },
		{ label: 'City area', value: plan.areaHectares, unit: 'ha' },
		{ label: 'Maximum height', value: step === '01' ? 0 : volume.maxHeight, unit: 'm' },
		{ label: 'Median height', value: step === '01' ? 0 : volume.medianHeight, unit: 'm' }
	]);

	function preparePlan(length: number) {
		const started = performance.now();
		const plan = createCityPlan(city, length);
		const generated = performance.now();
		const terrain = projectValleyWindow(city.valley, plan.window, city.heightScale);
		const ground = required(
			terrain.object.parts.find(({ slot }) => slot === 'ground'),
			'valley ground'
		).shape;
		if (ground.kind !== 'mesh') throw new Error('Expected a valley ground mesh');
		const { footprint } = terrain.object;
		const lines = terrainGridProjection(ground, terrain.toLocal, footprint)(plan.grid);
		let projected: ReturnType<typeof projectCityVolume>;
		let projectedHeights: readonly number[] = [];
		function project(volume: ReturnType<typeof plan.readVolume>['volume']) {
			const heights = volume.cells.map(({ height }) => height);
			if (!projected || heights.some((height, index) => height !== projectedHeights[index])) {
				projected = projectCityVolume(volume, lines.edgesByCellId, footprint);
				projectedHeights = heights;
			}
			return projected.drawables;
		}
		return {
			...plan,
			project,
			drawables: [...terrain.drawables, ...lines.drawables],
			generationMs: generated - started,
			projectionMs: performance.now() - generated
		};
	}

	function prepareVolume(plan: ReturnType<typeof preparePlan>, height: number, complexity: number) {
		const started = performance.now();
		const volume = plan.readVolume({ height, complexity });
		const generated = performance.now();
		const drawables = plan.project(volume.volume);
		return {
			...volume,
			drawables,
			generationMs: generated - started,
			projectionMs: performance.now() - generated
		};
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section
	class="grid grid-aside"
	aria-label="City plan and volume"
	data-generation-ms={(plan.generationMs + volume.generationMs).toFixed(2)}
	data-projection-ms={(plan.projectionMs + volume.projectionMs).toFixed(2)}
	data-volume-generation-ms={volume.generationMs.toFixed(2)}
	data-volume-projection-ms={volume.projectionMs.toFixed(2)}
>
	<div class="city-stage">
		<StageView
			{drawables}
			{view}
			display="normal"
			label={step === '01'
				? 'Coarse city plan on the valley terrace'
				: step === '02'
					? 'Translucent city volume of uniform height above the valley terrace'
					: 'Translucent city volume with high and low areas on the valley terrace'}
			landscape
			{fit}
		/>
		<ToggleGroup
			label="View"
			items={views}
			bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
		/>
		<dl class="data cluster city-measurements">
			{#each measurements as { label, value, unit } (label)}
				<div>
					<dt>{label}</dt>
					<dd>
						{format.format(value)}{#if unit}&nbsp;{unit}{/if}
					</dd>
				</div>
			{/each}
		</dl>
		<p class="data">{heightsScale}</p>
	</div>

	<Tabs label="City steps" items={steps} bind:value={step}>
		{#snippet panel(active)}
			<div class="stack">
				{#if active === '01'}
					<p>
						The city starts as a coarse plan of cells that follows the contours of the valley. As
						the city grows, new cells join the plan and the existing cells stay in place.
					</p>
					<Slider
						label={sizeParam.label}
						min={sizeParam.min}
						max={sizeParam.max}
						step={sizeParam.step}
						bind:value={citySize}
					/>
				{:else if active === '02'}
					<p>
						Each cell rises by the same height above its ground line. The transparent hull shows the
						cell walls and the plan beneath them. At 3 meters and above, the height limit rounds
						down to whole storeys.
					</p>
					<Slider
						label={heightParam.label}
						min={heightParam.min}
						max={heightParam.max}
						step={heightParam.step}
						bind:value={height}
					/>
				{:else}
					<p>
						The same cells form a few high areas with lower cells around them. Increasing complexity
						deepens the difference between high and low areas.
					</p>
					<Slider
						label={complexityParam.label}
						min={complexityParam.min}
						max={complexityParam.max}
						step={complexityParam.step}
						bind:value={complexity}
					/>
				{/if}
			</div>
		{/snippet}
	</Tabs>
</section>
