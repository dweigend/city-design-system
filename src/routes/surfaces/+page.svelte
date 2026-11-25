<script module lang="ts">
	export const lead =
		'An architectural model of a library and a board of sample plates show how the city’s workshop materials read at different levels of detail.';
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { specimenSettings } from '../../config/surface-specimens';
	import {
		familyNames,
		surfaceLevels,
		type Family,
		type SurfaceLevel
	} from '../../lib/domain/material';
	import { existing, paintClad, type MaterialDisplay } from '../../lib/scene/surface';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { Switch } from '../../lib/ui/switch';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import ChapterViewer from '../ChapterViewer.svelte';
	import { chapterAt } from '../chapters';
	import { createSampleBoard } from './board';
	import { createSampleBody } from './body';
	import { familyLabels, groundFamily, levelLabels, readControl, readSpecimen } from './controls';

	const chapter = chapterAt('/surfaces');
	const portalTo = '.surfaces-hero .chapter-viewer';
	const format = new Intl.NumberFormat('en');
	const specimens = [
		{ value: 'body', label: 'Body' },
		{ value: 'board', label: 'Plates' }
	];
	const wallFamilies = familyNames.filter((family) => family !== groundFamily);
	const levels = surfaceLevels.map((value) => ({ value, label: levelLabels[value] }));
	const [moduleMin, moduleMax, moduleStep] = specimenSettings.moduleScaleBand;
	const [seedMin, seedMax, seedStep] = specimenSettings.seedBand;

	const location = $derived(page.shallow?.url ?? page.url);
	const specimen = $derived(readSpecimen(location.searchParams));
	const isBody = $derived(specimen === 'body');

	function selectSpecimen(value: string) {
		const query = new SvelteURLSearchParams(location.search);
		query.set('specimen', value);
		void goto(resolve(`/surfaces?${query}${location.hash}`), {
			shallow: true,
			replace: true,
			reset: false,
			state: page.state
		});
	}

	function zoomFromQuery(key: string) {
		const query = location.searchParams;
		const value = Number(query.get(key));
		return query.has(key) && Number.isFinite(value) ? value : 1;
	}

	const queryShown = $derived(location.searchParams.get('show'));
	const queryLevels = $derived(location.searchParams.get('levels'));
	const shown = $derived(
		(queryShown ?? '')
			.split(',')
			.flatMap((value) => familyNames.find((family) => family === value) ?? [])
	);
	let levelRow = $derived(
		(queryLevels ?? '')
			.split(',')
			.flatMap((value) => surfaceLevels.find((level) => level === value) ?? [])
	);
	const queryLevel = $derived(location.searchParams.get('level'));
	const queryDisplay = $derived(location.searchParams.get('display'));
	const queryModule = $derived(location.searchParams.get('module'));
	const querySeed = $derived(location.searchParams.get('seed'));
	const queryBody = $derived(location.searchParams.get('body'));
	let level = $derived(surfaceLevels.find((value) => value === queryLevel) ?? 'near');
	let transparent = $derived(queryDisplay === 'transparency');
	let moduleScale = $derived(readControl(queryModule, specimenSettings.moduleScaleBand));
	let seed = $derived(readControl(querySeed, specimenSettings.seedBand));
	let bodyFamily = $derived<string>(familyNames.find((family) => family === queryBody) ?? 'board');
	function selectLevel(value: string) {
		level = surfaceLevels.find((item) => item === value) ?? 'near';
		if (!isBody && levelRow.length) levelRow = [];
	}

	const family = $derived(familyNames.find((value) => value === bodyFamily) ?? 'board');
	const bodies = $derived(
		(queryBody === groundFamily ? familyNames : wallFamilies).map((value) => ({
			value,
			label: familyLabels[value]
		}))
	);
	const zoom = $derived(zoomFromQuery('zoom'));
	const bodyZoom = $derived(zoomFromQuery('bodyZoom'));
	const boardFit = $derived({ zoom });
	const bodyFit = $derived({ zoom: bodyZoom });

	const display = $derived<MaterialDisplay>(transparent ? 'transparency' : 'normal');
	const options = $derived({ seed, moduleScale, level });
	const entries = $derived<{ family: Family; level?: SurfaceLevel }[]>(
		levelRow.length
			? levelRow.map((rowLevel) => ({ family: shown[0] ?? 'stripe', level: rowLevel }))
			: (shown.length ? shown : familyNames).map((family) => ({ family }))
	);
	const plateLabels = $derived(
		entries.map(({ family, level }) =>
			level ? `${familyLabels[family]} (${levelLabels[level]})` : familyLabels[family]
		)
	);
	const board = $derived(createSampleBoard(entries, options));
	const body = $derived(createSampleBody(family, options));
	const plain = { stand: existing.roof };
	const drawables = $derived(isBody ? paintClad(body, display) : paintClad(board, display, plain));
	const plateTriangles = $derived(Math.max(...board.surfaces.map(({ triangles }) => triangles)));
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader title={chapter.title} />

<section class="chapter-hero surfaces-hero" aria-label="Material specimens">
	<ChapterViewer
		resetKey={location.search}
		stage={{
			drawables,
			view: 'iso',
			display,
			fit: isBody ? bodyFit : boardFit,
			interactive: true,
			label: isBody
				? `${familyLabels[family]} library model with a cantilevered reading room and flat roofs`
				: `Sample plates: ${plateLabels.join(', ')}`
		}}
	>
		{#snippet controls()}
			<div class="control-choice">
				<ToggleGroup
					label="Specimen"
					showLabel
					items={specimens}
					bind:value={() => specimen, selectSpecimen}
				/>
			</div>
			<div class="control-choice surfaces-level">
				<ToggleGroup
					label="Level"
					showLabel
					items={levels}
					bind:value={() => (!isBody && levelRow.length ? '' : level), selectLevel}
				/>
			</div>
			<div class="surfaces-finish">
				{#if isBody}
					<Select label="Walls" items={bodies} {portalTo} bind:value={bodyFamily} />
				{/if}
				<Switch label="Transparency" bind:checked={transparent} />
			</div>
			<div class="surfaces-sliders">
				<Slider
					label="Pattern scale"
					min={moduleMin}
					max={moduleMax}
					step={moduleStep}
					bind:value={moduleScale}
				/>
				<Slider label="Seed" min={seedMin} max={seedMax} step={seedStep} bind:value={seed} />
			</div>
		{/snippet}
	</ChapterViewer>
	<p class="data surfaces-budget" role="status">
		{#if isBody}
			Body {format.format(body.triangles)} of {format.format(specimenSettings.bodyTriangleBudget)} triangles
		{:else}
			Largest plate {format.format(plateTriangles)} of {format.format(
				specimenSettings.plateTriangleBudget
			)}
			triangles · all plates {format.format(board.triangles)}
		{/if}
	</p>
	{#if !isBody}
		<p class="small surfaces-legend">
			{plateLabels.join(' · ')}
		</p>
	{/if}
</section>

<div class="chapter-notes stack">
	<p class="lead">{lead}</p>
	<p>
		The lower library bar and cantilevered reading room share one wall material. Stripes and
		perforations follow the same coordinates across both volumes. Flat roof slabs frame the massing,
		and recessed acrylic lights mark the entrance and reading rooms.
	</p>
	<p>
		Near shows grain, printed patterns and panel joints. Mid retains the openings. Far keeps the
		silhouette and large graphic patterns. Plain uses solid tones, and Pencil traces the edges and
		joints. Transparency draws the materials as a grey veil.
	</p>
	<ul>
		<li>Use one workshop material and one tone across a body.</li>
		<li>Limit a building to a dominant body, a contrasting body and one small accent.</li>
		<li>Keep saturated matte solids and warm neutrals distinct from the flow colours.</li>
		<li>Recess openings and draw panel joints as hairlines.</li>
		<li>Let light distinguish faces by value and use lit acrylic once per building.</li>
	</ul>
</div>
