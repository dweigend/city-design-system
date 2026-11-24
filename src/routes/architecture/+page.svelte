<script module lang="ts">
	export const lead =
		'A house is a rule over the cells of its parcel: it fills some, keeps others open, and the court is the space it leaves.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { blockInputs, resolveParams } from '../../lib/core/params';
	import { Random } from '../../lib/core/random';
	import type { DisplayLevel } from '../../lib/scene/focus';
	import type { View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { Button } from '../../lib/ui/button';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import { parcelShapes, type ParcelShape } from './parcels';
	import { inputsSheet, levelsSheet, shapesSheet, single } from './sheets';
	import { townSheet } from './town';

	const chapter = chapterAt('/architecture');
	const query = page.url.searchParams;
	const number = (key: string, fallback: number) => {
		const value = Number(query.get(key));
		return query.has(key) && Number.isFinite(value) ? value : fallback;
	};
	const initial = resolveParams(blockInputs, {
		height: number('height', 14),
		width: number('width', 28),
		complexity: number('complexity', 0.6)
	});
	const shapes = Object.entries(parcelShapes).map(([value, { label }]) => ({ value, label }));
	const levels = [
		{ value: 'full', label: 'Full' },
		{ value: 'silhouette', label: 'Block' },
		{ value: 'pencil', label: 'Pencil' }
	];
	const sheets = [
		{ value: 'one', label: 'One house' },
		{ value: 'shapes', label: 'All parcels' },
		{ value: 'levels', label: 'Display levels' },
		{ value: 'inputs', label: 'Height × complexity' },
		{ value: 'town', label: 'In the town' }
	];
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
	// Look over the lower rear wing into the court, a little steeper than the city view.
	const fit = {
		bearing: (number('bearing', 212) * Math.PI) / 180,
		elevation: (number('elevation', 36) * Math.PI) / 180
	};

	let shape = $state<ParcelShape>(
		(query.get('shape') as ParcelShape) in parcelShapes
			? (query.get('shape') as ParcelShape)
			: 'rectangle'
	);
	let height = $state(initial.height);
	let width = $state(initial.width);
	let complexity = $state(initial.complexity);
	let seed = $state(number('seed', 3));
	let level = $state<DisplayLevel>((query.get('level') as DisplayLevel) ?? 'full');
	let sheet = $state(query.get('sheet') ?? 'one');
	let view = $state<View>(query.get('view') === 'plan' ? 'plan' : 'iso');

	const setup = $derived({ shape, height, width, complexity, seed, level });
	const house = $derived(single(setup));
	const drawables = $derived(
		sheet === 'shapes'
			? shapesSheet(setup)
			: sheet === 'levels'
				? levelsSheet(setup)
				: sheet === 'inputs'
					? inputsSheet(setup)
					: sheet === 'town'
						? townSheet(setup).drawables
						: house.drawables
	);
	const measurements = $derived([
		{
			label: 'Cells built / void',
			value: `${house.figures.builtCells} / ${house.figures.voidCells}`,
			unit: ''
		},
		{ label: 'Floor area', value: format.format(house.figures.floorAreaM2), unit: 'm²' },
		{ label: 'Court', value: format.format(house.figures.courtAreaM2), unit: 'm²' },
		{ label: 'Storeys', value: String(house.figures.storeys), unit: '' }
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
			{drawables}
			{view}
			display="normal"
			{fit}
			interactive
			label="A court house of stepped white cell volumes with a pink gallery and stair around a green court"
		/>
		<div class="cluster">
			<ToggleGroup
				label="View"
				items={views}
				bind:value={() => view, (value) => (view = value === 'plan' ? 'plan' : 'iso')}
			/>
			<ToggleGroup label="Show" items={sheets} bind:value={sheet} />
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
			street inward. The innermost ring stays open as the court, a gate opens the shortest way to
			it, and with rising complexity the volumes step down to the rear and the court and gain a pink
			gallery and stair.
		</p>
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
