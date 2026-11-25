<script module lang="ts">
	export const lead =
		'Valley topography carries the plan grid. The size of the settlement decides its districts and its skyline, and a coarse lattice follows the plan up to that height profile.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { resolveParams } from '../../lib/core/params';
	import { Random } from '../../lib/core/random';
	import {
		cityVolumeParams,
		createCityLattice,
		createCityTaper,
		readCityColumns,
		type DistrictKind,
		type LatticeVariant,
		type SettlementKind
	} from '../../lib/domain/city-volume';
	import {
		cityElevation,
		cityFocusPreset,
		type FocusChoice,
		cityPresentation,
		cityProfile,
		projectCityDistricts,
		projectCityTerrain,
		projectCityLattice
	} from '../../lib/scene/city-volume-projection';
	import type { View, Viewport } from '../../lib/scene/stage';
	import {
		createCitySlider,
		readCityFit,
		readCityPlanDrawables,
		readCityStep,
		readCityStepDrawables,
		readCityStepFocus,
		readCitySubject,
		readCitySubjectPoints
	} from './city';
	import { valleyParams } from '../../lib/domain/valley';
	import { cityHeightScaleM } from '../../lib/scene/surface';
	import { Button } from '../../lib/ui/button';
	import { ScaleLegend } from '../../lib/ui/scale-legend';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { Tabs } from '../../lib/ui/tabs';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import {
		cityLatticesByPlan,
		cityPlanVariants,
		type CityPlanVariant,
		citySiteParams,
		createCitySite,
		readCityDistricts,
		readCityGrid,
		readCityParcels,
		riverCityRecipe
	} from '../../lib/world/city-site';
	import TerrainControls from '../TerrainControls.svelte';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/city');
	const portalTo = '.city-hero .chapter-viewer';
	const { choices: focusChoices } = cityFocusPreset;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const profiles = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'true', label: 'True scale' }
	];
	const gridLabels: Record<CityPlanVariant, string> = {
		organic: 'Organic',
		square: 'Square',
		hex: 'Hexagon',
		triangle: 'Triangle',
		bands: 'Axes',
		contour: 'Contour',
		voronoi: 'Voronoi'
	};
	const latticeLabels: Record<LatticeVariant, string> = {
		box: 'Box',
		braced: 'Braced',
		centered: 'Body-centered',
		tetrahedral: 'Tetrahedral',
		antiprism: 'Antiprism',
		diagrid: 'Diagrid',
		tree: 'Tree'
	};
	const grids = cityPlanVariants.map((value) => ({ value, label: gridLabels[value] }));
	const steps = [
		{ value: '01', label: 'Plan' },
		{ value: '02', label: 'Districts' },
		{ value: '03', label: 'Lattice' }
	];
	const { citySize: sizeParam, seed: seedParam } = citySiteParams;
	const settlementLabels: Record<SettlementKind, string> = {
		village: 'Village',
		town: 'Town',
		city: 'City'
	};
	const { height: heightParam, complexity: complexityParam, taper: taperParam } = cityVolumeParams;

	function valueFromQuery(key: string) {
		const raw = page.url.searchParams.get(key);
		if (raw === null || raw.trim() === '') return undefined;
		const value = Number(raw);
		return Number.isFinite(value) ? value : undefined;
	}

	function choice<T extends string>(key: string, choices: readonly T[]) {
		return choices.find((choice) => choice === page.url.searchParams.get(key)) ?? choices[0];
	}

	let gridVariant = $derived(choice('grid', cityPlanVariants));
	const compatible = $derived(cityLatticesByPlan[gridVariant]);
	const frames = $derived(compatible.map((value) => ({ value, label: latticeLabels[value] })));
	let selectedLattice = $derived(choice('lattice', cityLatticesByPlan.organic));
	const latticeVariant = $derived(
		compatible.includes(selectedLattice) ? selectedLattice : compatible[0]
	);
	let profile = $derived(choice('profile', ['auto', 'true']));
	let focus = $derived<FocusChoice | undefined>(
		focusChoices.find((value) => value === page.url.searchParams.get('focus'))
	);
	let viewport = $state.raw<Viewport>({ width: 1, metersPerPixel: 0, center: [0, 0, 0] });
	let step = $derived(readCityStep(page.url.searchParams.get('step')));
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	const citySize = $derived(createCitySlider(sizeParam, valueFromQuery('city')));
	const height = $derived(createCitySlider(heightParam, valueFromQuery('height')));
	const complexity = $derived(createCitySlider(complexityParam, valueFromQuery('complexity')));
	const sizeDraft = $derived(citySize.draft);
	const heightDraft = $derived(height.draft);
	const complexityDraft = $derived(complexity.draft);
	let seed = $derived(
		resolveParams(citySiteParams, { seed: valueFromQuery('seed') ?? seedParam.default }).seed
	);
	let taper = $derived(
		resolveParams({ taper: taperParam }, { taper: valueFromQuery('taper') ?? taperParam.default })
			.taper
	);

	let terrainSettings = $derived<Readonly<Record<string, number>>>(
		resolveParams(
			valleyParams,
			Object.fromEntries(
				Object.entries(valleyParams).map(([key, param]) => [
					key,
					valueFromQuery(key) ?? param.default
				])
			)
		)
	);
	const city = $derived(createCitySite(undefined, { ...terrainSettings, seed }));
	const plan = $derived(readCityGrid(city, $citySize, gridVariant, seed));
	const recipe = $derived(city.recipe ?? riverCityRecipe);
	// Every step stands on the whole plan, water cells included, so the plan and its crossings are
	// one set of overlays that the focus draws at every step.
	const terrain = $derived(projectCityTerrain(city, plan.grid, plan.plan));
	const maxProfileScale = $derived(terrain.autoHeightScale);
	const districts = $derived(
		readCityDistricts(city, plan, seed, { height: $height, complexity: $complexity })
	);
	const columns = $derived(readCityColumns(plan.grid, districts));
	// Only the step's drawable readers consume these projections. Framing uses column corners.
	const taperField = $derived(createCityTaper(columns, plan.datumZ, recipe.levelHeightM));
	const envelope = $derived(
		projectCityDistricts(
			columns,
			plan.datumZ,
			terrain,
			taperField,
			seed,
			undefined,
			recipe.levelHeightM
		)
	);
	const lattice = $derived(createCityLattice(columns, plan.datumZ, latticeVariant, recipe));
	const members = $derived(projectCityLattice(lattice, terrain, taperField));
	const holdings = $derived(readCityParcels(city, plan));
	const { planLines, parcelDrawables } = $derived(
		readCityPlanDrawables(terrain, plan.selectedCrossings, holdings)
	);
	const focusState = $derived(
		readCityStepFocus(step, districts.shares, [...planLines, ...parcelDrawables], focus)
	);
	const relief = $derived(city.valley.parameters.relief);
	const subject = $derived(
		readCitySubject(
			view,
			relief,
			readCitySubjectPoints(columns, plan.datumZ, terrain, recipe.levelHeightM)
		)
	);
	const cityFit = $derived(
		readCityFit(relief, subject, valueFromQuery('width'), [
			valueFromQuery('x') ?? 0,
			valueFromQuery('y') ?? 0
		])
	);
	const ground = $derived([...terrain.drawables, ...planLines, ...parcelDrawables]);
	const { tiles, wires } = $derived(
		readCityStepDrawables(
			step,
			() => envelope.drawables,
			() => members.drawables
		)
	);
	const drawables = $derived([...ground, ...tiles, ...wires]);
	const heightFactor = $derived(
		cityProfile(
			viewport.width,
			viewport.metersPerPixel,
			districts.peakHeight,
			cityElevation(relief, viewport.width),
			profile === 'true',
			maxProfileScale
		).factor
	);
	const presentation = $derived(
		cityPresentation({
			terrain: ground,
			envelope: tiles,
			members: wires,
			focus: focusState.active,
			peak: step === '01' ? 0 : districts.peakHeight,
			relief,
			trueScale: profile === 'true',
			maxProfileScale,
			levelHeightM: recipe.levelHeightM,
			taper
		})
	);

	function setViewport(value: Viewport) {
		viewport = value;
	}
	const stage = {
		get drawables() {
			return drawables;
		},
		get view() {
			return view;
		},
		display: 'normal' as const,
		get label() {
			if (focusState.active === 'parcels' || step === '01')
				return 'City plan showing pedestrian lanes, bridges and holdings';
			if (step === '02') return 'Stepped district heights above the city plan';
			return 'Continuous carrier lattice under the stepped district envelope';
		},
		landscape: true,
		interactive: true,
		get presentation() {
			return presentation;
		},
		onViewport: setViewport,
		// Keep focus and presentation changes from invalidating StageView's navigation fit.
		get fit() {
			return cityFit;
		}
	};

	const measurements = $derived([
		{
			label: columns.length ? settlementLabels[districts.settlement] : 'Built-up area',
			value: format.format(plan.areaKm2),
			unit: 'km²'
		},
		{ label: 'Plan cells', value: format.format(plan.plan.cells.length), unit: '' },
		...(step === '01'
			? []
			: [
					...districtMeasurements(columns),
					{ label: 'Peak', value: format.format(districts.peakHeight), unit: 'm' },
					{ label: 'Height', value: `×${heightFactor.toFixed(1)}`, unit: '' }
				])
	]);

	const kindLabels: Record<DistrictKind, string> = {
		detached: 'Detached',
		block: 'Blocks',
		center: 'Center'
	};

	function districtMeasurements(cells: typeof columns) {
		const storeys: Record<DistrictKind, number[]> = { detached: [], block: [], center: [] };
		for (const { kind, levels } of cells) storeys[kind].push(levels * recipe.storeysPerLevel);
		return (Object.keys(storeys) as DistrictKind[])
			.filter((kind) => storeys[kind].length)
			.map((kind) => {
				const low = Math.min(...storeys[kind]);
				const high = Math.max(...storeys[kind]);
				const range = low === high ? `${low}` : `${low}–${high}`;
				const share = Math.round(100 * districts.shares[kind]);
				return { label: kindLabels[kind], value: `${range} storeys · ${share} %`, unit: '' };
			});
	}

	function drawSeed() {
		seed = Math.floor(Random.create({ seed }).derive('new-city').number() * 2 ** 32);
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<Tabs label="City steps" items={steps} bind:value={step}>
	{#snippet layout(tabList, panels)}
		<ChapterHeader title={chapter.title} />
		<section class="chapter-hero city-hero" aria-label="City plan, districts and lattice">
			<ChapterViewer resetKey={page.url.search} {stage}>
				{#snippet controls()}
					{@render tabList()}
					<div class="city-view-settings">
						<Select
							label="Plan grid"
							items={grids}
							{portalTo}
							bind:value={
								() => gridVariant,
								(value) =>
									(gridVariant =
										cityPlanVariants.find((variant) => variant === value) ?? cityPlanVariants[0])
							}
						/>
						{#if step === '03'}
							<Select
								label="Lattice"
								items={frames}
								{portalTo}
								bind:value={
									() => latticeVariant,
									(value) =>
										(selectedLattice =
											compatible.find((variant) => variant === value) ?? compatible[0])
								}
							/>
						{/if}
						<Select
							label="Focus"
							items={focusState.items}
							{portalTo}
							bind:value={
								() => focusState.active,
								(value) => (focus = focusChoices.find((choice) => choice === value))
							}
						/>
						<div class="control-choice">
							<ToggleGroup
								label="View"
								showLabel
								items={views}
								bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
							/>
						</div>
					</div>
				{/snippet}
			</ChapterViewer>
		</section>

		<div class="chapter-notes stack">
			{@render panels()}
			<details class="city-specialist-panel">
				<summary>Terrain and profile</summary>
				<div class="city-parameters">
					<TerrainControls schema={valleyParams} bind:values={terrainSettings} />
					{#if step !== '01'}
						<div class="control-choice">
							<ToggleGroup label="Profile" showLabel items={profiles} bind:value={profile} />
						</div>
					{/if}
				</div>
			</details>
		</div>
	{/snippet}

	{#snippet panel(active)}
		<div class="grid grid-aside">
			<div class="stack city-edit">
				<div class="city-parameters">
					<Slider
						label={sizeParam.label}
						min={sizeParam.min}
						max={sizeParam.max}
						step={sizeParam.step}
						bind:value={$sizeDraft}
						onCommit={citySize.commit}
					/>
					{#if active !== '01'}
						<Slider
							label={heightParam.label}
							min={heightParam.min}
							max={heightParam.max}
							step={heightParam.step}
							bind:value={$heightDraft}
							onCommit={height.commit}
						/>
						<Slider
							label={complexityParam.label}
							min={complexityParam.min}
							max={complexityParam.max}
							step={complexityParam.step}
							bind:value={$complexityDraft}
							onCommit={complexity.commit}
						/>
						<Slider
							label={taperParam.label}
							min={taperParam.min}
							max={taperParam.max}
							step={taperParam.step}
							bind:value={taper}
						/>
					{/if}
				</div>
				<Button label="New city" onclick={drawSeed} />
			</div>
			<div class="stack">
				<p class="lead">{lead}</p>
				{#if active === '01'}
					<p>
						The 60 m grid continues across water. Edges in the water hue mark water cells, and pink
						lines show the selected bridges along grid edges or straight between bank nodes.
					</p>
				{:else if active === '02'}
					<p>
						A village keeps two storeys. A town adds six-storey blocks. Only a city of several
						square kilometres grows a center, falling in steps from its peak to the block eaves.
					</p>
				{:else}
					<p>The coarse lattice rises on shared 7 m levels. Plots and finer grids follow.</p>
				{/if}
				{#if active !== '01' && focusState.analysis === 'height'}
					<ScaleLegend
						label="Column height in meters"
						values={['0', String(cityHeightScaleM / 2), String(cityHeightScaleM)]}
						unit="m"
					/>
				{/if}
				{#if active === step}
					<dl class="data cluster city-measurements">
						{#each measurements as { label, value, unit } (label)}
							<div>
								<dt>{label}</dt>
								<dd>
									{value}{#if unit}&nbsp;{unit}{/if}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</div>
		</div>
	{/snippet}
</Tabs>
