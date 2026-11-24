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
	} from '../../lib/domain/material';
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
		board: 'Painted board',
		card: 'Grey board',
		cork: 'Cork',
		stripe: 'Stripe laminate',
		perforated: 'Perforated sheet',
		acrylic: 'Lit acrylic',
		ground: 'Ground'
	};
	const levelNames: Record<SurfaceLevel, string> = {
		near: 'Near',
		mid: 'Mid',
		far: 'Far',
		plain: 'Plain',
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
		surfaceLevels.find((value) => value === query.get('level')) ?? 'near'
	);
	let transparent = $state(query.get('display') === 'transparency');
	let moduleScale = $state(readControl(query.get('module'), specimenSettings.moduleScaleBand));
	let seed = $state(readControl(query.get('seed'), specimenSettings.seedBand));
	let bodyFamily = $state<string>(pickFamily(query.get('body')) ?? 'board');
	const zoom = number('zoom', 1);
	const bodyZoom = number('bodyZoom', 1);

	const display = $derived<MaterialDisplay>(transparent ? 'transparency' : 'normal');
	const options = $derived({ seed, moduleScale, level });
	const entries = $derived<{ family: Family; level?: SurfaceLevel }[]>(
		levelRow.length
			? levelRow.map((rowLevel) => ({ family: shown[0] ?? 'stripe', level: rowLevel }))
			: (shown.length ? shown : familyNames).map((family) => ({ family }))
	);
	const board = $derived(createSampleBoard(entries, options));
	const body = $derived(createSampleBody(pickFamily(bodyFamily) ?? 'board', options));
	const plain = { stand: existing.roof };
	const boardDrawables = $derived(paintClad(board, display, plain));
	const bodyDrawables = $derived(paintClad(body, display));
	const plateTriangles = $derived(Math.max(...board.surfaces.map(({ triangles }) => triangles)));

	const levels = surfaceLevels.map((value) => ({ value, label: levelNames[value] }));
	const bodies = wallFamilies.map((value) => ({ value, label: names[value] }));
	const [moduleMin, moduleMax, moduleStep] = specimenSettings.moduleScaleBand;
	const [seedMin, seedMax, seedStep] = specimenSettings.seedBand;
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="stack" aria-label="Sample plates">
	<h2>Model materials, not facades</h2>
	<p>
		A house is drawn as an architectural model, built from the materials of the model workshop:
		painted board, grey board, cork, stripe laminate, perforated sheet, lit acrylic and an abstract
		ground. Every body is one material in one tone. Texture is either fine and even, like the grain
		of cork, or a flat graphic pattern, like stripes and dots, and a pattern covers a whole body and
		runs on over its edges. Each recipe carries no colour; the palette paints it at one boundary,
		and the transparency view turns every plate into the same grey veil.
	</p>
	<ul>
		<li>One body, one material, one tone: no courses, joints or weathering across a face.</li>
		<li>Three parts per house at most: a dominant body, a contrasting body, one small accent.</li>
		<li>
			Saturated matte solids beside cork, cream, chocolate and grey board, kept clear of the flow
			colours.
		</li>
		<li>
			Openings are few and plain: a recessed dark hole; a panel joint is one hairline at most.
		</li>
		<li>
			Light makes the form: faces differ in value only. Lit acrylic is light as material, once per
			house.
		</li>
	</ul>
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
			label="Pattern scale"
			min={moduleMin}
			max={moduleMax}
			step={moduleStep}
			bind:value={moduleScale}
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
	<h2>The same material on a house</h2>
	<p>
		On a body the material meets corners, a gable, a door, two windows and the ground. Its pattern
		is laid in the coordinates of the whole body, so stripes and dots run on round the corners
		instead of starting again on every wall. The roof takes one flat tone and the windows are lit
		acrylic. With distance the house simplifies: near shows grain and panel joints, mid the openings
		and every pattern, far only the plain body and a large graphic pattern, and pencil a drawing of
		its joints.
	</p>
	<div class="city-stage">
		<StageView
			drawables={bodyDrawables}
			view="iso"
			{display}
			fit={{ zoom: bodyZoom }}
			interactive
			label={`${names[pickFamily(bodyFamily) ?? 'board']} model house with a gable roof on a ground plate`}
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
