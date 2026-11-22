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
	import { citySiteParams, createCitySite, readCityGrid } from '../../lib/world/city-site';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';

	const chapter = chapterAt('/city');
	const city = createCitySite();
	const terrain = projectValleyWindow(city.valley, city.window, city.heightScale);
	const ground = required(
		terrain.object.parts.find(({ slot }) => slot === 'ground'),
		'valley ground'
	).shape;
	if (ground.kind !== 'mesh') throw new Error('Expected a valley ground mesh');

	const projectGrid = terrainGridProjection(ground, terrain.toLocal, terrain.object.footprint);

	const cellParam = terrainGridParams.cellSize;
	const siteParam = citySiteParams.siteSize;
	const format = new Intl.NumberFormat('en');
	const area = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
	const fit = { bearing: (23 * Math.PI) / 180, elevation: (40 * Math.PI) / 180, fill: 0.98 };
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
	let siteSize = $derived(
		resolveParams(citySiteParams, { siteSize: valueFromQuery('site') ?? siteParam.default })
			.siteSize
	);
	let view = $derived<View>(page.url.searchParams.get('view') === 'plan' ? 'plan' : 'iso');
	const model = $derived(prepareGrid(siteSize, cellSize));

	function prepareGrid(length: number, cell: number) {
		const start = performance.now();
		const { grid, areaHectares } = readCityGrid(city, length, cell);
		const generated = performance.now();
		const overlay = projectGrid(grid);
		return {
			drawables: [...terrain.drawables, ...overlay.drawables],
			cellCount: grid.cells.length,
			areaHectares,
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
			<p>The grid follows the contours of the valley. Its cells leave steep slopes open.</p>
			<p>
				The grid gives the city room to grow. As the site grows, its existing cells stay in place.
			</p>
		</div>
		<Slider
			label={cellParam.label}
			min={cellParam.min}
			max={cellParam.max}
			step={cellParam.step}
			bind:value={cellSize}
		/>
		<Slider
			label={siteParam.label}
			min={siteParam.min}
			max={siteParam.max}
			step={siteParam.step}
			bind:value={siteSize}
		/>
		<ToggleGroup label="View" items={views} bind:value={() => view, selectView} />
		<div class="stack valley-observations">
			<dl class="data">
				<div>
					<dt>Cells</dt>
					<dd>{format.format(model.cellCount)}</dd>
				</div>
				<div>
					<dt>Cell size</dt>
					<dd>{cellSize}&nbsp;m</dd>
				</div>
				<div>
					<dt>Site area</dt>
					<dd>{area.format(model.areaHectares)}&nbsp;ha</dd>
				</div>
			</dl>
			<p class="caption">
				<span class="data">Seed {city.valley.seed} · Heights ×{city.heightScale}</span>
			</p>
		</div>
	</div>
</section>
