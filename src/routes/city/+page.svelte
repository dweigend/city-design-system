<script module lang="ts">
	export const lead =
		'Valley topography carries the plan grid. The size of the settlement decides its districts and its skyline, and a coarse lattice follows the plan up to that height profile.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { required } from '../../lib/core/invariant';
	import { resolveParams } from '../../lib/core/params';
	import { Random } from '../../lib/core/random';
	import {
		cityLatticesByPlan,
		cityPlanVariants,
		cityVolumeParams,
		createCityLattice,
		levelHeight,
		readCityColumns,
		type CityPlanVariant,
		type DistrictKind,
		type LatticeVariant,
		type SettlementKind
	} from '../../lib/domain/city-volume';
	import {
		cityPresentation,
		cityProfile,
		projectCityDistricts,
		projectCityLattice
	} from '../../lib/scene/city-volume-projection';
	import type { Display, View, Viewport } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { terrainGridProjection } from '../../lib/scene/terrain-grid-projection';
	import { projectValleyWindow } from '../../lib/scene/valley-projection';
	import { Button } from '../../lib/ui/button';
	import { ScaleLegend } from '../../lib/ui/scale-legend';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { Tabs } from '../../lib/ui/tabs';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import {
		citySiteParams,
		cityWindow,
		createCitySite,
		readCityDistricts,
		readCityGrid
	} from '../../lib/world/city-site';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/city');
	const city = createCitySite();
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const displays = [
		{ value: 'normal', label: 'Normal' },
		{ value: 'transparency', label: 'Transparency' }
	];
	const profiles = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'true', label: 'True scale' }
	];
	const colours = [
		{ value: 'districts', label: 'Districts' },
		{ value: 'height', label: 'Height' }
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
		tetrahedral: 'Tetrahedral'
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

	let gridVariant = $derived(choice('grid', cityPlanVariants));
	const compatible = $derived(cityLatticesByPlan[gridVariant]);
	const frames = $derived(compatible.map((value) => ({ value, label: latticeLabels[value] })));
	let selectedLattice = $derived(choice('lattice', cityLatticesByPlan.organic));
	const latticeVariant = $derived(
		compatible.includes(selectedLattice) ? selectedLattice : compatible[0]
	);
	let display = $derived<Display>(
		page.url.searchParams.get('display') === 'transparency' ? 'transparency' : 'normal'
	);
	let profile = $derived(choice('profile', ['auto', 'true']));
	let colour = $derived(choice('colour', ['districts', 'height']));
	let viewport = $state.raw<Viewport>({ width: 1, metersPerPixel: 0 });
	let step = $derived(stepFromQuery());
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	let citySize = $derived(
		resolveParams(citySiteParams, { citySize: valueFromQuery('city') ?? sizeParam.default })
			.citySize
	);
	let seed = $derived(
		resolveParams(citySiteParams, { seed: valueFromQuery('seed') ?? seedParam.default }).seed
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
	const plan = $derived(readCityGrid(city, citySize, gridVariant, seed));
	const lines = $derived(terrain.projectPlan(plan.grid));
	const districts = $derived(readCityDistricts(city, plan.grid, seed, { height, complexity }));
	const columns = $derived(readCityColumns(plan.grid, districts));
	const envelope = $derived(projectCityDistricts(columns, city.datumZ, terrain, true));
	const lattice = $derived(createCityLattice(columns, city.datumZ, gridVariant, latticeVariant));
	const members = $derived(projectCityLattice(lattice, terrain));
	const elevation = (17 * Math.PI) / 180;
	const volumeFit = $derived({
		bearing: (-24 * Math.PI) / 180,
		elevation,
		fill: 0.89,
		focus: envelope.focus,
		width: valueFromQuery('width') ? Math.max(120, valueFromQuery('width') ?? 120) : undefined,
		offset: [valueFromQuery('x') ?? 0, valueFromQuery('y') ?? 0] as const
	});
	const planFit = $derived({ ...volumeFit, elevation: (28 * Math.PI) / 180 });
	const relief = $derived(step === '01' ? lines.drawables : lines.traces);
	const ground = $derived([...terrain.drawables, ...relief]);
	const tiles = $derived(step === '01' ? [] : envelope.drawables);
	const wires = $derived(step === '03' ? members.drawables : []);
	const drawables = $derived([...ground, ...tiles, ...wires]);
	const legendPeak = $derived(Math.max(2 * levelHeight, districts.peakHeight));
	const heightFactor = $derived(
		cityProfile(
			viewport.width,
			viewport.metersPerPixel,
			districts.peakHeight,
			elevation,
			profile === 'true'
		).factor
	);
	const presentation = $derived(
		step === '01'
			? undefined
			: cityPresentation({
					terrain: ground,
					envelope: tiles,
					members: wires,
					datum: city.datumZ,
					peak: districts.peakHeight,
					elevation,
					open: step === '03',
					heat: colour === 'height',
					trueScale: profile === 'true'
				})
	);

	function setViewport(value: Viewport) {
		viewport = value;
	}

	const measurements = $derived([
		{
			label: settlementLabels[districts.settlement],
			value: format.format(plan.areaKm2),
			unit: 'km²'
		},
		{ label: 'Plan cells', value: format.format(plan.grid.cells.length), unit: '' },
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
		for (const { kind, levels } of cells) storeys[kind].push(levels * 2);
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

<section class="grid grid-aside" aria-label="City plan, districts and lattice">
	<div class="city-stage">
		<StageView
			{drawables}
			{view}
			{display}
			label={step === '01'
				? 'City plan on the valley terrace'
				: step === '02'
					? 'Stepped district heights above the city plan'
					: 'Continuous carrier lattice under the stepped district envelope'}
			landscape
			interactive
			{presentation}
			onViewport={setViewport}
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
		{#if step !== '01'}
			<div class="cluster">
				<ToggleGroup label="Profile" items={profiles} bind:value={profile} />
				<ToggleGroup label="Colour" items={colours} bind:value={colour} />
			</div>
			{#if colour === 'height'}
				<ScaleLegend
					label="Column height in meters"
					values={[
						String(levelHeight),
						format.format((levelHeight + legendPeak) / 2),
						String(legendPeak)
					]}
					unit="m"
				/>
			{/if}
		{/if}
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
	</div>

	<div class="stack">
		<Select
			label="Plan grid"
			items={grids}
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
				bind:value={
					() => latticeVariant,
					(value) =>
						(selectedLattice = compatible.find((variant) => variant === value) ?? compatible[0])
				}
			/>
		{/if}
		<Tabs label="City steps" items={steps} bind:value={step}>
			{#snippet panel(active)}
				<div class="stack">
					{#if active === '01'}
						<p>
							The plan grid covers the upper terrace in 60 m cells, within one storey of the datum.
						</p>
					{:else if active === '02'}
						<p>
							A village keeps two storeys. A town adds six-storey blocks. Only a city of several
							square kilometres grows a center, falling in steps from its peak to the block eaves.
						</p>
					{:else}
						<p>The coarse lattice rises on shared 7 m levels. Plots and finer grids follow.</p>
					{/if}
					<Button label="New city" onclick={drawSeed} />
					<Slider
						label={sizeParam.label}
						min={sizeParam.min}
						max={sizeParam.max}
						step={sizeParam.step}
						bind:value={citySize}
					/>
					{#if active !== '01'}
						<Slider
							label={heightParam.label}
							min={heightParam.min}
							max={heightParam.max}
							step={heightParam.step}
							bind:value={height}
						/>
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
