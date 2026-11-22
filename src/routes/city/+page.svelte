<script module lang="ts">
	export const lead =
		'The city follows the valley floor. A continuous height profile sets its upper limit and a three-dimensional grid fills the space below.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { required } from '../../lib/core/invariant';
	import { resolveParams } from '../../lib/core/params';
	import {
		cityVolumeParams,
		createCityLattice,
		latticeVariants,
		readCityColumns,
		type LatticeVariant
	} from '../../lib/domain/city-volume';
	import { planVariants, type PlanVariant } from '../../lib/domain/terrain-grid';
	import { projectCityLattice, projectCityProfile } from '../../lib/scene/city-volume-projection';
	import type { Display, View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { planningOverlay } from '../../lib/scene/surface';
	import { terrainGridProjection } from '../../lib/scene/terrain-grid-projection';
	import { projectValleyWindow } from '../../lib/scene/valley-projection';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { Tabs } from '../../lib/ui/tabs';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import {
		cityOutline,
		citySiteParams,
		cityWindow,
		createCitySite,
		readCityGrid,
		readCityProfile
	} from '../../lib/world/city-site';
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
	const displays = [
		{ value: 'normal', label: 'Normal' },
		{ value: 'transparency', label: 'Transparency' }
	];
	const gridLabels: Record<PlanVariant, string> = {
		organic: 'Organic',
		square: 'Square',
		hex: 'Hexagon',
		triangle: 'Triangle',
		bands: 'Axes',
		contour: 'Contour',
		polar: 'Polar',
		voronoi: 'Voronoi',
		'free-quad': 'Free quad'
	};
	const latticeLabels: Record<LatticeVariant, string> = {
		box: 'Box',
		braced: 'Braced',
		centered: 'Body-centered',
		tetrahedral: 'Tetrahedral'
	};
	const grids = planVariants.map((value) => ({ value, label: gridLabels[value] }));
	const frames = latticeVariants.map((value) => ({ value, label: latticeLabels[value] }));
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

	function choice<T extends string>(key: string, choices: readonly T[]) {
		return choices.find((choice) => choice === page.url.searchParams.get(key)) ?? choices[0];
	}

	let gridVariant = $derived(choice('grid', planVariants));
	let latticeVariant = $derived(choice('lattice', latticeVariants));
	let display = $derived<Display>(
		page.url.searchParams.get('display') === 'transparency' ? 'transparency' : 'normal'
	);
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

	const terrain = $derived(prepareTerrain(citySize));
	const plan = $derived(readCityGrid(city, citySize, gridVariant));
	const lines = $derived(terrain.projectPlan(plan.grid));
	const profile = $derived(readCityProfile(city, { height, complexity }));
	const surface = $derived(
		projectCityProfile(profile, cityOutline(city, citySize), terrain, groundHeight)
	);
	const columns = $derived(readCityColumns(plan.grid, profile));
	const lattice = $derived(createCityLattice(columns, latticeVariant));
	const members = $derived(projectCityLattice(lattice, terrain));
	const volumeFit = $derived({
		bearing: (-34 * Math.PI) / 180,
		elevation: (33 * Math.PI) / 180,
		fill: 0.94,
		zoom: 1.12,
		focus: surface.focus
	});
	const drawables = $derived([
		...terrain.drawables,
		...(step === '01' ? lines.drawables : lines.traces),
		...surface.drawables.map((part) => ({
			...part,
			...(step === '03' ? planningOverlay : {}),
			visible: step !== '01'
		})),
		...members.drawables.map((part) => ({ ...part, visible: step === '03' }))
	]);

	const measurements = $derived([
		{ label: 'Plan cells', value: plan.grid.cells.length, unit: '' },
		{ label: 'City area', value: plan.areaHectares, unit: 'ha' },
		...(step === '01' ? [] : [{ label: 'Peak height', value: height, unit: 'm' }]),
		...(step === '03' ? [{ label: 'Grid cells', value: lattice.cells.length, unit: '' }] : [])
	]);

	function groundHeight(x: number, y: number) {
		return city.valley.sampleGround(x, y).height;
	}

	function prepareTerrain(length: number) {
		const terrain = projectValleyWindow(city.valley, cityWindow(city, length), city.heightScale);
		const ground = required(
			terrain.object.parts.find(({ slot }) => slot === 'ground'),
			'valley ground'
		).shape;
		if (ground.kind !== 'mesh') throw new Error('Expected a valley ground mesh');
		const { footprint } = terrain.object;
		return {
			footprint,
			toLocal: terrain.toLocal,
			drawables: terrain.drawables,
			projectPlan: terrainGridProjection(ground, terrain.toLocal, footprint)
		};
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="grid grid-aside" aria-label="City plan, profile and grid">
	<div class="city-stage">
		<StageView
			{drawables}
			{view}
			{display}
			label={step === '01'
				? 'City plan on the valley terrace'
				: step === '02'
					? 'Elevation profile above the city plan'
					: 'Lattice members and joints beneath the elevation contours'}
			landscape
			fit={step === '01' ? planFit : volumeFit}
		/>
		<div class="cluster">
			<ToggleGroup
				label="View"
				items={views}
				bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
			/>
			<ToggleGroup
				label="Display"
				items={displays}
				bind:value={
					() => display, (value) => (display = value === 'transparency' ? 'transparency' : 'normal')
				}
			/>
		</div>
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

	<div class="stack">
		<Select
			label="Plan grid"
			items={grids}
			bind:value={
				() => gridVariant,
				(value) =>
					(gridVariant = planVariants.find((variant) => variant === value) ?? planVariants[0])
			}
		/>
		{#if step === '03'}
			<Select
				label="Lattice"
				items={frames}
				bind:value={
					() => latticeVariant,
					(value) =>
						(latticeVariant =
							latticeVariants.find((variant) => variant === value) ?? latticeVariants[0])
				}
			/>
		{/if}
		<Tabs label="City steps" items={steps} bind:value={step}>
			{#snippet panel(active)}
				<div class="stack">
					{#if active === '01'}
						<p>
							Organic and Free quad use irregular quads, Square, Triangle and Hexagon tile the plan,
							and Axes, Contour, Polar and Voronoi follow bands, curves, rings and seeded points.
						</p>
						<Slider
							label={sizeParam.label}
							min={sizeParam.min}
							max={sizeParam.max}
							step={sizeParam.step}
							bind:value={citySize}
						/>
					{:else if active === '02'}
						<p>Height sets the summit in meters above ground.</p>
						<Slider
							label={heightParam.label}
							min={heightParam.min}
							max={heightParam.max}
							step={heightParam.step}
							bind:value={height}
						/>
					{:else}
						<p>
							Box follows the edges, Braced adds side diagonals, Body-centered adds a central joint,
							and Tetrahedral draws the edges of a tetrahedral split.
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
	</div>
</section>
