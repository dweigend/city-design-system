<script module lang="ts">
	export const lead =
		'Footpaths connect both banks at ground level and above the roofs. Stations join the same walking network.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { Random } from '../../lib/core/random';
	import type { Vec3 } from '../../lib/core/geometry';
	import { resolveParams } from '../../lib/core/params';
	import { readCityColumns } from '../../lib/domain/city-volume';
	import { valleyParams } from '../../lib/domain/valley';
	import {
		cityCameraBearingRad,
		cityCameraMinimumWidthM,
		cityElevation,
		cityFrameFillFlat,
		cityPresentation,
		projectCityDistricts,
		projectCityTerrain
	} from '../../lib/scene/city-volume-projection';
	import {
		pathsFocusPreset,
		pathsPresentation,
		projectMovement,
		projectMovementRoute,
		projectTransitLine,
		type PathsFocusChoice,
		type MovementDrawing
	} from '../../lib/scene/paths-projection';
	import { projectFocus, type View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { projectValleyWindow } from '../../lib/scene/valley-projection';
	import { Button } from '../../lib/ui/button';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import {
		readCityMovement,
		readCityRail,
		walkwayLevelOffsets,
		type CityMovementKind
	} from '../../lib/world/city-movement';
	import {
		cityPlanVariants,
		type CityPlanVariant,
		citySiteParams,
		cityWindow,
		createCitySite,
		readCityDistricts,
		readCityGrid,
		readCityParcels
	} from '../../lib/world/city-site';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import { crossingHeads, dockQuarter, portalRoute, railDemo } from './demo';

	const chapter = chapterAt('/paths');
	const { choices: focusChoices } = pathsFocusPreset;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
	const grids: Record<CityPlanVariant, string> = {
		organic: 'Organic',
		square: 'Square',
		hex: 'Hexagon',
		triangle: 'Triangle',
		bands: 'Axes',
		contour: 'Contour',
		voronoi: 'Voronoi'
	};
	const gridItems = cityPlanVariants.map((value) => ({ value, label: grids[value] }));
	const levels = walkwayLevelOffsets.map((offset, index) => ({
		value: String(offset),
		label: ['Lower', 'Eaves', 'Upper'][index]
	}));
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const extents = [
		{ value: 'town', label: 'Town' },
		{ value: 'valley', label: 'Valley' }
	];
	const routeChoices = [
		{ value: 'off', label: 'Hide' },
		{ value: 'on', label: 'Show' }
	];
	const mode: Record<CityMovementKind, MovementDrawing> = {
		lane: 'ground',
		bridge: 'bridge',
		stair: 'stairs',
		walkway: 'deck'
	};
	const kinds: Record<CityMovementKind, string> = {
		lane: 'Lanes',
		bridge: 'Bridges',
		stair: 'Stairs',
		walkway: 'Walkways'
	};

	function numberFromQuery(key: string) {
		const raw = page.url.searchParams.get(key);
		if (raw === null || raw.trim() === '') return undefined;
		const value = Number(raw);
		return Number.isFinite(value) ? value : undefined;
	}

	let { seed, citySize } = $derived(
		resolveParams(citySiteParams, {
			seed: numberFromQuery('seed') ?? citySiteParams.seed.default,
			citySize: numberFromQuery('city') ?? citySiteParams.citySize.default
		})
	);
	let relief = $derived(
		resolveParams(valleyParams, {
			relief: numberFromQuery('relief') ?? valleyParams.relief.default
		}).relief
	);
	let grid = $derived(
		cityPlanVariants.find((value) => value === page.url.searchParams.get('grid')) ??
			cityPlanVariants[0]
	);
	let offset = $derived(
		levels.find(({ value }) => value === page.url.searchParams.get('level'))?.value ?? '0'
	);
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	let extent = $derived(page.url.searchParams.get('extent') === 'valley' ? 'valley' : 'town');
	let routeMode = $derived(page.url.searchParams.get('route') === 'on' ? 'on' : 'off');
	let requestedFocus = $derived<PathsFocusChoice | undefined>(
		focusChoices.find((value) => value === page.url.searchParams.get('focus')) ??
			(page.url.searchParams.get('view') === 'plan' ? 'plan' : undefined)
	);
	const site = $derived(createCitySite(undefined, { seed, relief }));
	const layout = $derived(readCityGrid(site, citySize, grid, seed));
	const holdings = $derived(readCityParcels(site, layout));
	const districts = $derived(readCityDistricts(site, layout, seed));
	const columns = $derived(readCityColumns(layout.grid, districts));
	const heads = $derived(crossingHeads(layout));
	const rail = $derived(readCityRail(site, layout, columns, railDemo(site, layout, heads)));
	const movement = $derived(readCityMovement(site, layout, columns, Number(offset), rail, heads));
	const routeEnds = $derived(heads.map((id) => movement.elevatedNodeIds.get(id) ?? 'ground/' + id));
	const route = $derived(portalRoute(site, movement, rail, heads));

	const terrain = $derived.by(() => {
		if (extent !== 'valley' || !rail) return projectCityTerrain(site, layout.grid, layout.plan);
		const window = cityWindow(site, layout.plan);
		return projectValleyWindow(
			site.valley,
			{ ...window, origin: site.origin, length: rail.lengthM },
			1
		);
	});
	const ground = $derived([
		...terrain.drawables,
		...('projectParcels' in terrain ? terrain.projectParcels(holdings) : [])
	]);
	const envelope = $derived(projectCityDistricts(columns, layout.datumZ, terrain, undefined, seed));
	const paths = $derived(projectMovement(movement.network, mode, terrain));
	const transit = $derived(projectTransitLine(rail, terrain));
	const highlight = $derived(projectMovementRoute(movement.network, route, mode, terrain));
	const focus = $derived(
		pathsFocusPreset.selectFocus(
			[
				'terrain',
				'water',
				'lanes',
				'walkways',
				...(holdings.parcels.length ? ['parcels', 'merged-units'] : []),
				...Object.entries(districts.shares)
					.filter(([, share]) => share > 0)
					.map(([kind]) => kind),
				...(rail ? ['transit'] : [])
			],
			requestedFocus,
			extent === 'valley' ? 'rail' : view === 'plan' ? 'plan' : 'paths'
		)
	);

	const context = $derived(
		cityPresentation({
			terrain: ground,
			envelope: envelope.drawables,
			members: [],
			focus,
			peak: districts.peakHeight,
			relief,
			trueScale: true,
			maxProfileScale: terrain.autoHeightScale,
			taper: 0
		})
	);
	const drawables = $derived([
		...ground,
		...envelope.drawables,
		...paths.drawables,
		...transit.drawables,
		...highlight.drawables
	]);
	const presentation = $derived(
		pathsPresentation(
			context,
			paths.drawables,
			transit.drawables,
			highlight.drawables,
			focus.active,
			routeMode === 'on'
		)
	);
	const camera = $derived({
		bearing: cityCameraBearingRad,
		elevation: cityElevation(relief),
		fill: cityFrameFillFlat
	});
	const subject = $derived.by(() => {
		if (extent === 'valley') return undefined;
		const frame = page.url.searchParams.get('frame');
		if (frame === 'dock') {
			const points = dockQuarter(layout, movement, rail);
			const planSubject =
				points &&
				projectFocus(
					'plan',
					camera,
					points.map(([x, y]): Vec3 => [...terrain.toLocal(x, y), 0])
				);
			if (planSubject) return projectFocus(view, camera, [planSubject.center]);
		}
		if (frame === 'route' && route) {
			return projectFocus(
				view,
				camera,
				route.edges.flatMap(({ points }) =>
					points.map(([x, y, z]): Vec3 => [...terrain.toLocal(x, y), z])
				)
			);
		}
		if (frame !== 'crossing' || !routeEnds.length)
			return projectFocus(view, camera, envelope.points());
		const points = routeEnds.flatMap((id): Vec3[] => {
			const node = movement.network.readNode(id);
			if (!node) return [];
			const [x, y, z] = node.position;
			return [[...terrain.toLocal(x, y), z]];
		});
		return projectFocus(view, camera, points);
	});
	const width = $derived(numberFromQuery('width'));
	const fit = $derived({
		...camera,
		elevationAtWidth: (width: number) => cityElevation(relief, width),
		subject,
		width: width === undefined ? undefined : Math.max(cityCameraMinimumWidthM, width),
		offset: [numberFromQuery('x') ?? 0, numberFromQuery('y') ?? 0] as const
	});
	const distances = $derived.by(() => {
		const totals: Record<CityMovementKind, number> = { lane: 0, bridge: 0, stair: 0, walkway: 0 };
		for (const { kind, lengthM } of movement.network.edges) totals[kind] += lengthM;
		return (Object.keys(totals) as CityMovementKind[]).map((kind) => ({
			label: kinds[kind],
			value: format.format(totals[kind] / 1000),
			unit: 'km'
		}));
	});
	const measurements = $derived([
		...distances,
		{ label: 'Rail', value: format.format((rail?.lengthM ?? 0) / 1000), unit: 'km' },
		{ label: 'Stations', value: format.format(rail?.stations.length ?? 0), unit: '' },
		...(routeMode === 'on' && route
			? [
					{ label: 'Route', value: format.format(route.lengthM), unit: 'm' },
					{ label: 'Climb', value: format.format(route.climbM), unit: 'm' }
				]
			: [])
	]);

	function drawSeed() {
		seed = Math.floor(Random.create({ seed }).derive('new-city').number() * 2 ** 32);
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="grid grid-aside" aria-label="Walking network and elevated rail">
	<div class="city-stage">
		<StageView
			{drawables}
			{view}
			display="normal"
			label="Pink walking routes and an elevated rail line with stations"
			landscape
			interactive
			{presentation}
			{fit}
		/>
		<div class="cluster">
			<ToggleGroup
				label="View"
				items={views}
				bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
			/>
			<ToggleGroup label="Extent" items={extents} bind:value={extent} />
			<Select
				label="Focus"
				items={focus.items}
				bind:value={
					() => focus.active,
					(value) => (requestedFocus = focusChoices.find((choice) => choice === value))
				}
			/>
		</div>
		<dl class="data cluster city-measurements" aria-live="polite">
			{#each measurements as { label, value, unit } (label)}
				<div>
					<dt>{label}</dt>
					<dd>
						{value}{#if unit}&nbsp;{unit}{/if}
					</dd>
				</div>
			{/each}
		</dl>
		{#if routeMode === 'on' && !route}
			<p class="small" role="status">No parcel portal reaches a station on the opposite bank.</p>
		{/if}
	</div>
	<div class="stack">
		<p>
			Pink lanes show the ground reserved for walking. Stairs connect them to raised paths and
			station docks.
		</p>
		<Button label="New town" onclick={drawSeed} />
		<Select
			label="Plan grid"
			items={gridItems}
			bind:value={
				() => grid,
				(value) =>
					(grid = cityPlanVariants.find((variant) => variant === value) ?? cityPlanVariants[0])
			}
		/>
		<Select label="Walkway level" items={levels} bind:value={offset} />
		<div class="control-choice">
			<ToggleGroup
				label="Portal to station route"
				showLabel
				items={routeChoices}
				bind:value={routeMode}
			/>
		</div>
		{#if extent === 'valley'}
			<Slider
				label={valleyParams.relief.label}
				min={valleyParams.relief.min}
				max={valleyParams.relief.max}
				step={valleyParams.relief.step}
				bind:value={relief}
			/>
		{/if}
	</div>
</section>
