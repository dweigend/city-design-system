<script module lang="ts">
	export const lead =
		'The city follows the valley floor. A continuous height profile sets its upper limit and a three-dimensional grid fills the space below.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { required } from '../../lib/core/invariant';
	import { bounds } from '../../lib/core/object';
	import { resolveParams } from '../../lib/core/params';
	import { cityVolumeParams } from '../../lib/domain/city-volume';
	import { projectCityVolume } from '../../lib/scene/city-volume-projection';
	import type { View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { planningOverlay } from '../../lib/scene/surface';
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
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
	const planFit = { bearing: (10 * Math.PI) / 180, elevation: (28 * Math.PI) / 180, fill: 0.98 };
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const steps = [
		{ value: '01', label: 'Plan' },
		{ value: '02', label: 'Profile' },
		{ value: '03', label: 'Grid' }
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

	const plan = $derived(preparePlan(citySize));
	const volume = $derived(prepareVolume(plan, height, complexity));
	const volumeFit = $derived({
		bearing: (-34 * Math.PI) / 180,
		elevation: (33 * Math.PI) / 180,
		fill: 0.9,
		zoom: 1.16,
		focus: volume.projection.object.parts.length ? bounds(volume.projection.object) : undefined
	});
	const drawables = $derived([
		...plan.terrainDrawables,
		...(step === '01' ? plan.lines.drawables : plan.lines.traces),
		...volume.projection.drawables.map((part) => ({
			...part,
			...(part.id === 'profile' && step === '03' ? planningOverlay : {}),
			visible: part.id === 'lattice' ? step === '03' : step !== '01'
		}))
	]);

	const measurements = $derived([
		{ label: 'Plan cells', value: plan.grid.cells.length, unit: '' },
		{ label: 'City area', value: plan.areaHectares, unit: 'ha' },
		...(step === '01' ? [] : [{ label: 'Peak height', value: volume.peakHeight, unit: 'm' }]),
		...(step === '03' ? [{ label: 'Grid cells', value: volume.grid.cells.length, unit: '' }] : [])
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
		return {
			...plan,
			footprint,
			toLocal: terrain.toLocal,
			terrainDrawables: terrain.drawables,
			lines,
			generationMs: generated - started,
			projectionMs: performance.now() - generated
		};
	}

	function prepareVolume(plan: ReturnType<typeof preparePlan>, height: number, complexity: number) {
		const started = performance.now();
		const volume = plan.readVolume({ height, complexity });
		const generated = performance.now();
		const projection = projectCityVolume(
			volume,
			plan.grid,
			plan.footprint,
			plan.toLocal,
			(x, y) => city.valley.sampleGround(x, y).height
		);
		return {
			...volume,
			peakHeight: volume.profile.height(...volume.profile.summit),
			projection,
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
	aria-label="City plan, profile and grid"
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
					? 'Elevation profile above the city plan'
					: 'Stacked lattice cells beneath the city’s elevation profile'}
			landscape
			fit={step === '01' ? planFit : volumeFit}
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
						One continuous surface rises from the city edge to a main peak and lower shoulders.
						Height sets the summit in meters above the ground.
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
						Each plan cell holds as many full levels as fit under the profile at its center. Higher
						complexity brings out secondary peaks and saddles.
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
