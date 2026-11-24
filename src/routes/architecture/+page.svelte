<script module lang="ts">
	export const lead =
		'A house is a rule over the cells of its parcel: it fills some, keeps others open, and the court is the space it leaves. A style changes how the cells are filled, not the rule.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { blockInputs } from '../../lib/core/params';
	import { Random } from '../../lib/core/random';
	import type { HouseStyleName } from '../../lib/domain/house-court';
	import type { DisplayLevel } from '../../lib/scene/focus';
	import { projectFocus, type View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { Button } from '../../lib/ui/button';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import { parcelShapes, type ParcelShape } from './parcels';
	import { readQuery } from './query';
	import { sheets, single, styleNames } from './sheets';
	import { townSheet, townStage, type TownScope, type TownStyles } from './town';

	const chapter = chapterAt('/architecture');
	const initial = readQuery(page.url.searchParams);
	const shapes = Object.entries(parcelShapes).map(([value, { label }]) => ({ value, label }));
	const styleLabels: Record<HouseStyleName, string> = {
		neutral: 'Neutral',
		memphis: 'Memphis',
		archigram: 'Archigram',
		organic: 'Organic'
	};
	const styleItems = styleNames.map((value) => ({ value, label: styleLabels[value] }));
	const levels = [
		{ value: 'full', label: 'Full' },
		{ value: 'silhouette', label: 'Block' },
		{ value: 'pencil', label: 'Pencil' }
	];
	const sheetItems = [
		{ value: 'one', label: 'One house' },
		{ value: 'styles', label: 'All styles' },
		{ value: 'shapes', label: 'All parcels' },
		{ value: 'levels', label: 'Display levels' },
		{ value: 'inputs', label: 'Height × complexity' },
		{ value: 'town', label: 'Town' }
	];
	const townBlocks = [
		{ value: 'block', label: 'Perimeter block' },
		{ value: 'neighbour', label: 'Neighbouring block' },
		{ value: 'merged', label: 'Merged hall' },
		{ value: 'town', label: 'Two blocks and a hall' }
	];
	const townStyleItems = [
		{ value: 'one', label: 'One style' },
		{ value: 'mixed', label: 'One per block' }
	];
	const scopeOf = (value: string): TownScope =>
		(townBlocks.find((item) => item.value === value)?.value as TownScope | undefined) ?? 'block';
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
	// Look over the lower rear wing into the court, a little steeper than the city view.
	const fit = {
		bearing: (initial.bearing * Math.PI) / 180,
		elevation: (initial.elevation * Math.PI) / 180
	};

	let shape = $state<ParcelShape>(initial.setup.shape);
	let style = $state<HouseStyleName>(initial.setup.style);
	let height = $state(initial.setup.height);
	let width = $state(initial.setup.width);
	let complexity = $state(initial.setup.complexity);
	let seed = $state(initial.setup.seed);
	let level = $state<DisplayLevel>(initial.setup.level);
	let sheet = $state<string>(initial.sheet);
	let view = $state<View>(initial.view);
	let block = $state<TownScope>(initial.block);
	let townStyles = $state<TownStyles>(initial.styles);

	const setup = $derived({ shape, style, height, width, complexity, seed, level });
	const town = $derived(sheet === 'town' ? townStage(initial.relief) : undefined);
	const townResult = $derived(town && townSheet(town, block, setup, townStyles));
	const frame = $derived(
		townResult ? { ...fit, fill: 0.64, subject: projectFocus(view, fit, townResult.points) } : fit
	);
	const shown = $derived.by(() => {
		if (townResult) return townResult;
		const house = single(setup);
		const draw = Object.hasOwn(sheets, sheet) ? sheets[sheet as keyof typeof sheets] : undefined;
		return { drawables: draw ? draw(setup) : house.drawables, figures: house.figures };
	});
	const measurements = $derived([
		...(townResult ? [{ label: 'Houses', value: String(townResult.count), unit: '' }] : []),
		{
			label: 'Cells built / void',
			value: `${shown.figures.builtCells} / ${shown.figures.voidCells}`,
			unit: ''
		},
		{ label: 'Floor area', value: format.format(shown.figures.floorAreaM2), unit: 'm²' },
		{ label: 'Court', value: format.format(shown.figures.courtAreaM2), unit: 'm²' },
		{ label: 'Storeys', value: String(shown.figures.storeys), unit: '' }
	]);

	function drawSeed() {
		seed = Math.floor(Random.create({ seed }).derive('new-house').number() * 2 ** 32);
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

<section class="grid grid-aside" aria-label="House and court on a parcel">
	<div class="city-stage">
		<StageView
			drawables={shown.drawables}
			{view}
			display="normal"
			fit={frame}
			interactive
			landscape={Boolean(townResult)}
			label={townResult
				? 'Parcel houses and their lanes in the default town'
				: 'Court houses of one cell rule in neutral, Memphis, Archigram and organic styles'}
		/>
		<div class="cluster">
			<ToggleGroup
				label="View"
				items={views}
				bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
			/>
			<Select label="Show" items={sheetItems} bind:value={sheet} />
		</div>
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
		<p>
			The parcel is split by the grid rule: one quad per corner through the centre and the edge
			midpoints, once more inside each quad, and storeys of 3.5 m. The house claims cells from the
			alley inward. The innermost ring stays open as the court, and a gate opens the shortest way to
			it.
		</p>
		<p>
			A style is a row of parameters over the same cells. Memphis stacks bold primitive solids in
			flat colour. Archigram raises a grey frame on the cell edges and plugs capsules and services
			into it. Organic rounds every cell into a pod and steps down to a planted court.
		</p>
		<Select
			label="Style"
			items={styleItems}
			bind:value={
				() => style, (value) => (style = styleNames.find((name) => name === value) ?? 'memphis')
			}
		/>
		{#if townResult}
			<Select
				label="Block"
				items={townBlocks}
				bind:value={() => block, (value) => (block = scopeOf(value))}
			/>
			<ToggleGroup
				label="Styles"
				items={townStyleItems}
				bind:value={() => townStyles, (value) => (townStyles = value === 'mixed' ? 'mixed' : 'one')}
			/>
		{:else}
			<Select
				label="Parcel"
				items={shapes}
				bind:value={
					() => shape,
					(value) =>
						(shape = (Object.keys(parcelShapes).find((key) => key === value) ??
							'rectangle') as ParcelShape)
				}
			/>
		{/if}
		<ToggleGroup
			label="Display level"
			items={levels}
			bind:value={() => level, (value) => (level = value as DisplayLevel)}
		/>
		<Button label="New house" onclick={drawSeed} />
		<Slider
			label={blockInputs.height.label}
			min={blockInputs.height.min}
			max={blockInputs.height.max}
			step={blockInputs.height.step}
			bind:value={height}
		/>
		<Slider
			label={blockInputs.width.label}
			min={blockInputs.width.min}
			max={blockInputs.width.max}
			step={blockInputs.width.step}
			bind:value={width}
		/>
		<Slider
			label={blockInputs.complexity.label}
			min={blockInputs.complexity.min}
			max={blockInputs.complexity.max}
			step={blockInputs.complexity.step}
			bind:value={complexity}
		/>
	</div>
</section>
