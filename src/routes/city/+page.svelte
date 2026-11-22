<script module lang="ts">
	export const lead =
		'The city grows from the terrain as grids, building shapes and events give it form without a master plan.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { required } from '../../lib/core/invariant';
	import { resolveParams } from '../../lib/core/params';
	import { terrainGridParams } from '../../lib/domain/terrain-grid';
	import { StageView } from '../../lib/scene/stage-view';
	import type { View } from '../../lib/scene/stage';
	import { projectValleyWindow } from '../../lib/scene/valley-projection';
	import { terrainGridProjection } from '../../lib/scene/terrain-grid-projection';
	import {
		citySiteParams,
		cityWindow,
		createCitySite,
		readCityGrid
	} from '../../lib/world/city-site';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/city');
	const city = createCitySite();

	const cellParam = terrainGridParams.cellSize;
	const cityParam = citySiteParams.citySize;
	const format = new Intl.NumberFormat('en');
	const area = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const fit = { bearing: (10 * Math.PI) / 180, elevation: (51 * Math.PI) / 180, fill: 0.98 };
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];

	function valueFromQuery(key: string) {
		const raw = page.url.searchParams.get(key);
		if (raw === null || raw.trim() === '') return undefined;
		const value = Number(raw);
		return Number.isFinite(value) ? value : undefined;
	}

	let cellSize = $derived(
		resolveParams(terrainGridParams, { cellSize: valueFromQuery('cell') ?? cellParam.default })
			.cellSize
	);
	let citySize = $derived(
		resolveParams(citySiteParams, { citySize: valueFromQuery('city') ?? cityParam.default })
			.citySize
	);
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	const terrain = $derived(prepareTerrain(citySize));
	const model = $derived(prepareGrid(citySize, cellSize, terrain));

	function prepareTerrain(length: number) {
		const model = projectValleyWindow(city.valley, cityWindow(city, length), city.heightScale);
		const ground = required(
			model.object.parts.find(({ slot }) => slot === 'ground'),
			'valley ground'
		).shape;
		if (ground.kind !== 'mesh') throw new Error('Expected a valley ground mesh');
		return {
			drawables: model.drawables,
			project: terrainGridProjection(ground, model.toLocal, model.object.footprint)
		};
	}

	function prepareGrid(length: number, cell: number, terrain: ReturnType<typeof prepareTerrain>) {
		const start = performance.now();
		const { grid, areaHectares, medianCellSize } = readCityGrid(city, length, cell);
		const generated = performance.now();
		const overlay = terrain.project(grid);
		return {
			drawables: [...terrain.drawables, ...overlay.drawables],
			cellCount: grid.cells.length,
			areaHectares,
			medianCellSize,
			generationMs: generated - start,
			projectionMs: performance.now() - generated
		};
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
	class="grid grid-aside city-grid"
	aria-label="Terrain grid"
	data-generation-ms={model.generationMs.toFixed(2)}
	data-projection-ms={model.projectionMs.toFixed(2)}
>
	<StageView
		drawables={model.drawables}
		{view}
		display="normal"
		label="Relief map with an irregular quadrilateral grid on the valley terrace"
		landscape
		{fit}
	/>
	<div class="stack">
		<div class="stack">
			<p>The city starts as a coarse plan of cells that follows the contours of the valley.</p>
			<p>The city grows by adding cells. Existing cells stay where they are.</p>
		</div>
		<Slider
			label={cellParam.label}
			min={cellParam.min}
			max={cellParam.max}
			step={cellParam.step}
			bind:value={cellSize}
		/>
		<Slider
			label={cityParam.label}
			min={cityParam.min}
			max={cityParam.max}
			step={cityParam.step}
			bind:value={citySize}
		/>
		<ToggleGroup label="View" items={views} bind:value={() => view, selectView} />
		<div class="stack valley-observations">
			<dl class="data">
				<div>
					<dt>Cells</dt>
					<dd>{format.format(model.cellCount)}</dd>
				</div>
				<div>
					<dt>Median cell size</dt>
					<dd>{format.format(Math.round(model.medianCellSize))}&nbsp;m</dd>
				</div>
				<div>
					<dt>City area</dt>
					<dd>{area.format(model.areaHectares)}&nbsp;ha</dd>
				</div>
				<div>
					<dt>Height scale</dt>
					<dd>×{city.heightScale}</dd>
				</div>
			</dl>
		</div>
	</div>
</section>
