<script module lang="ts">
	export const lead =
		'The city draws on a chosen palette, with colors in the transparent view marking what infrastructure does and existing buildings shown as pale forms or pencil outlines.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import {
		familyNames,
		surfaceLevels,
		type Family,
		type SurfaceLevel
	} from '../../lib/scene/material';
	import { surfaceLight } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { existing, paintClad, type MaterialDisplay } from '../../lib/scene/surface';
	import { Slider } from '../../lib/ui/slider';
	import { Switch } from '../../lib/ui/switch';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import { createSampleBoard } from './board';
	import { createSampleBody } from './body';
	import { specimenSettings } from '../../config/surface-specimens';
	import { groundFamily, readControl } from './controls';

	const chapter = chapterAt('/surfaces');
	const names: Record<Family, string> = {
		render: 'Render',
		masonry: 'Masonry',
		timber: 'Timber',
		metal: 'Metal',
		glass: 'Glass',
		paving: 'Paving'
	};
	const levelNames: Record<SurfaceLevel, string> = {
		relief: 'Relief',
		flat: 'Flat',
		pencil: 'Pencil'
	};
	const wallFamilies = familyNames.filter((family) => family !== groundFamily);
	const query = page.url.searchParams;
	const pickFamily = (value: string | null) => familyNames.find((family) => family === value);
	const number = (key: string, fallback: number) => {
		const value = Number(query.get(key));
		return query.has(key) && Number.isFinite(value) ? value : fallback;
	};

	const shown = (query.get('show') ?? '').split(',').flatMap((value) => pickFamily(value) ?? []);
	const levelRow = (query.get('levels') ?? '')
		.split(',')
		.flatMap((value) => surfaceLevels.find((level) => level === value) ?? []);
	let level = $state<SurfaceLevel>(
		surfaceLevels.find((value) => value === query.get('level')) ?? 'relief'
	);
	let transparent = $state(query.get('display') === 'transparency');
	let moduleScale = $state(readControl(query.get('module'), specimenSettings.moduleScaleBand));
	let reliefScale = $state(readControl(query.get('relief'), specimenSettings.reliefScaleBand));
	let seed = $state(readControl(query.get('seed'), specimenSettings.seedBand));
	let bodyFamily = $state<string>(pickFamily(query.get('body')) ?? 'masonry');
	const zoom = number('zoom', 1);
	const bodyZoom = number('bodyZoom', 1);

	const display = $derived<MaterialDisplay>(transparent ? 'transparency' : 'normal');
	const options = $derived({ light: surfaceLight, seed, moduleScale, reliefScale, level });
	const entries = $derived<{ family: Family; level?: SurfaceLevel }[]>(
		levelRow.length
			? levelRow.map((rowLevel) => ({ family: shown[0] ?? 'masonry', level: rowLevel }))
			: (shown.length ? shown : familyNames).map((family) => ({ family }))
	);
	const board = $derived(createSampleBoard(entries, options));
	const body = $derived(createSampleBody(pickFamily(bodyFamily) ?? 'masonry', options));
	const plain = { stand: existing.roof };
	const boardDrawables = $derived(paintClad(board, display, plain));
	const bodyDrawables = $derived(paintClad(body, display));
	const plateTriangles = $derived(Math.max(...board.surfaces.map(({ triangles }) => triangles)));

	const levels = surfaceLevels.map((value) => ({ value, label: levelNames[value] }));
	const bodies = wallFamilies.map((value) => ({ value, label: names[value] }));
	const [moduleMin, moduleMax, moduleStep] = specimenSettings.moduleScaleBand;
	const [reliefMin, reliefMax, reliefStep] = specimenSettings.reliefScaleBand;
	const [seedMin, seedMax, seedStep] = specimenSettings.seedBand;
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="stack" aria-label="Sample plates">
	<h2>Six surfaces, one recipe each</h2>
	<p>
		Every surface is a recipe, not a picture: render, masonry, timber, metal, glass and paving lay
		out units, joints and trim on any flat patch, in meters, and raise them as real relief. The
		light picks out each joint with a lit face, a shaded face and a fine line. The recipe carries no
		color; the palette colors each slot by material at one boundary, and the transparency view turns
		every plate into the same grey veil.
	</p>
	<div class="city-stage">
		<StageView
			drawables={boardDrawables}
			view="iso"
			{display}
			fit={{ zoom }}
			interactive
			label={`Sample plates: ${entries.map(({ family, level }) => names[family] + (level ? ` ${levelNames[level]}` : '')).join(', ')}`}
		/>
	</div>
	<div class="cluster">
		<ToggleGroup label="Level" items={levels} bind:value={level} />
		<Switch label="Transparency" bind:checked={transparent} />
		<Slider
			label="Module"
			min={moduleMin}
			max={moduleMax}
			step={moduleStep}
			bind:value={moduleScale}
		/>
		<Slider
			label="Relief"
			min={reliefMin}
			max={reliefMax}
			step={reliefStep}
			bind:value={reliefScale}
		/>
		<Slider label="Seed" min={seedMin} max={seedMax} step={seedStep} bind:value={seed} />
	</div>
	<p class="data">
		Largest plate {plateTriangles.toLocaleString('en')} of {specimenSettings.plateTriangleBudget.toLocaleString(
			'en'
		)} triangles · all plates {board.triangles.toLocaleString('en')}
	</p>
</section>

<section class="stack" aria-label="Surface on a body">
	<h2>The same recipe on a house</h2>
	<p>
		On a body the recipe meets corners, a gable, a door, a window and the ground. Units are cut at
		every edge and opening, the reveal shows the wall's depth, and the roof and the paving use their
		own families. Out of focus the same surface drops to a flat tone with edges, then to a pencil
		drawing of its joints.
	</p>
	<div class="city-stage">
		<StageView
			drawables={bodyDrawables}
			view="iso"
			{display}
			fit={{ zoom: bodyZoom }}
			interactive
			label={`${names[pickFamily(bodyFamily) ?? 'masonry']} house with a metal gable roof on paving`}
		/>
	</div>
	<div class="cluster">
		<ToggleGroup label="Walls" items={bodies} bind:value={bodyFamily} />
	</div>
	<p class="data">
		House {body.triangles.toLocaleString('en')} of {specimenSettings.bodyTriangleBudget.toLocaleString(
			'en'
		)} triangles
	</p>
</section>
