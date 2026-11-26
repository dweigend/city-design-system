<script module lang="ts">
	export const lead =
		'A house is a rule over the cells of its parcel: it fills some, keeps others open, and the court is the space it leaves. A style changes how the cells are filled, not the rule.';
</script>

<script lang="ts">
	import { page } from '$app/state';
	import { Random } from '../../lib/core/random';
	import { defaultStoreyHeightM } from '../../lib/domain/cell-space';
	import type { HouseStyleName } from '../../lib/domain/house-court';
	import type { DisplayLevel } from '../../lib/scene/focus';
	import { projectFocus, type Display, type View } from '../../lib/scene/stage';
	import { StageView } from '../../lib/scene/stage-view';
	import { Button } from '../../lib/ui/button';
	import { Select } from '../../lib/ui/select';
	import { Slider } from '../../lib/ui/slider';
	import { ToggleGroup } from '../../lib/ui/toggle-group';
	import ChapterHeader from '../ChapterHeader.svelte';
	import { chapterAt } from '../chapters';
	import {
		dissectMassing,
		dissectionModes,
		massingSheet,
		massingSpecimen,
		massingVariants,
		type MassingVariant
	} from './massing';
	import { parcelShapes, type ParcelShape } from './parcels';
	import { blockInputs, readQuery } from './query';
	import { sheets, single, styleNames } from './sheets';
	import { townSheet, townStage, type TownDetail, type TownScope, type TownStyles } from './town';

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
		{ value: 'massing', label: 'Massing operators' },
		{ value: 'town', label: 'Town' }
	];
	const townBlocks = [
		{ value: 'block', label: 'Perimeter block' },
		{ value: 'neighbour', label: 'Neighbouring block' },
		{ value: 'merged', label: 'Merged hall' },
		{ value: 'town', label: 'Two blocks and a hall' },
		{ value: 'all', label: 'Whole town' }
	];
	const detailItems = [
		{ value: 'salient', label: 'Salient' },
		{ value: 'plain', label: 'Plain' }
	];
	const townStyleItems = [
		{ value: 'one', label: 'One style' },
		{ value: 'mixed', label: 'One per block' }
	];
	const scopes: readonly TownScope[] = ['block', 'neighbour', 'merged', 'town', 'all'];
	const scopeOf = (value: string): TownScope => scopes.find((scope) => scope === value) ?? 'block';
	const views = [
		{ value: 'iso', label: 'Iso' },
		{ value: 'plan', label: 'Plan' }
	];
	const massingDisplays = [
		{ value: 'normal', label: 'Solid' },
		{ value: 'transparency', label: 'Transparency' }
	];
	const fullPercent = 100;
	const format = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
	// Look over the lower rear wing into the court, a little steeper than the city view.
	const fit = {
		bearing: (initial.bearing * Math.PI) / 180,
		elevation: (initial.elevation * Math.PI) / 180
	};

	const massingFit = {
		...fit,
		bearing: page.url.searchParams.has('bearing') ? fit.bearing : (328 * Math.PI) / 180
	};

	let shape = $state<ParcelShape>(initial.setup.shape);
	let style = $state<HouseStyleName>(initial.setup.style);
	let height = $state(initial.setup.height);
	let width = $state(initial.setup.width);
	let complexity = $state(initial.setup.complexity);
	let seed = $state(initial.setup.seed);
	let level = $state<DisplayLevel>(initial.setup.level);
	let sheet = $state<string>(initial.sheet);
	let variant = $state<MassingVariant>(massingVariants[0]);
	let dissection = $state<string>('assembled');
	let gap = $state(defaultStoreyHeightM / 2);
	// Start inside a cell so the cut opens the envelope away from the shared center faces.
	let cut = $state(55);
	let massingDisplay = $state<Display>('normal');
	let view = $state<View>(initial.view);
	let block = $state<TownScope>(initial.block);
	let townStyles = $state<TownStyles>(initial.styles);
	let detail = $state<TownDetail>(initial.detail);

	const setup = $derived({ shape, style, height, width, complexity, seed, level });
	const town = $derived(sheet === 'town' ? townStage(initial.relief) : undefined);
	const townResult = $derived(town && townSheet(town, block, setup, townStyles, detail));
	const specimen = $derived(sheet === 'massing' ? massingSpecimen(shape, style, seed) : undefined);
	const massingResult = $derived(specimen && massingSheet(specimen, variant));
	const gapM = $derived(dissection === 'exploded' ? gap : 0);
	const frame = $derived.by(() => {
		if (specimen) {
			const lift = (specimen.storeys - 1) * gapM;
			const points = specimen.points.map(
				([x, y, z]) => [x, y, z === specimen.space.baseZ ? z : z + lift] as const
			);
			return { ...massingFit, subject: projectFocus(view, massingFit, points) };
		}
		if (townResult)
			return { ...fit, fill: 0.64, subject: projectFocus(view, fit, townResult.points) };
		return fit;
	});
	const shown = $derived.by(() => {
		if (specimen && massingResult) {
			const cutY =
				dissection === 'section'
					? specimen.minY + ((specimen.maxY - specimen.minY) * cut) / fullPercent
					: undefined;
			return { ...massingResult, drawables: dissectMassing(massingResult, { gapM, cutY }) };
		}
		if (townResult) return townResult;
		const house = single(setup);
		const draw = Object.hasOwn(sheets, sheet) ? sheets[sheet as keyof typeof sheets] : undefined;
		return { drawables: draw ? draw(setup) : house.drawables, figures: house.figures };
	});
	const measurements = $derived.by(() => {
		if ('measurements' in shown) return shown.measurements;
		return [
			...(townResult
				? [
						{ label: 'Houses', value: String(townResult.count), unit: '' },
						...(townResult.unbuildable.length
							? [
									{
										label: 'Unbuildable parcels',
										value: String(townResult.unbuildable.length),
										unit: ''
									}
								]
							: []),
						{ label: 'Cladding', value: format.format(townResult.triangles), unit: 'triangles' }
					]
				: []),
			{
				label: 'Cells built / void',
				value: `${shown.figures.builtCells} / ${shown.figures.voidCells}`,
				unit: ''
			},
			{ label: 'Floor area', value: format.format(shown.figures.floorAreaM2), unit: 'm²' },
			{ label: 'Court', value: format.format(shown.figures.courtAreaM2), unit: 'm²' },
			{ label: 'Storeys', value: String(shown.figures.storeys), unit: '' }
		];
	});

	function drawSeed() {
		seed = Math.floor(Random.create({ seed }).derive('new-house').number() * 2 ** 32);
	}
</script>

<svelte:head>
	<title>{chapter.title} · City Design System</title>
</svelte:head>

<ChapterHeader number={chapter.number} title={chapter.title} {lead} />

{#snippet styleSelect()}
	<Select
		label="Style"
		items={styleItems}
		bind:value={
			() => style, (value) => (style = styleNames.find((name) => name === value) ?? 'memphis')
		}
	/>
{/snippet}

{#snippet parcelSelect()}
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
{/snippet}

<section
	class="grid grid-aside"
	aria-label={specimen ? 'Massing operators' : 'House and court on a parcel'}
>
	<div class="city-stage">
		<StageView
			drawables={shown.drawables}
			{view}
			display={specimen ? massingDisplay : 'normal'}
			fit={frame}
			interactive
			landscape={Boolean(townResult)}
			label={specimen
				? `Massing operators · ${variant.label}`
				: townResult
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
			{#if specimen}
				<Select
					label="Variant"
					items={massingVariants}
					bind:value={
						() => variant.value,
						(choice) =>
							(variant =
								massingVariants.find(({ value }) => value === choice) ?? massingVariants[0])
					}
				/>
			{/if}
		</div>
		<dl class="data cluster city-measurements" aria-live={specimen ? 'polite' : undefined}>
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
		{#if specimen}
			<p>
				Setback steps the upper storeys in from the street. Porosity carves terraces and through
				openings while keeping the ground-level route to the court.
			</p>
			<ToggleGroup label="Dissection" items={dissectionModes} bind:value={dissection} />
			{#if dissection === 'exploded'}
				<Slider
					label="Storey gap (m)"
					min={0}
					max={defaultStoreyHeightM}
					step={0.25}
					bind:value={gap}
				/>
			{:else if dissection === 'section'}
				<Slider label="Cut depth (%)" min={0} max={fullPercent} step={5} bind:value={cut} />
			{/if}
			<ToggleGroup
				label="Fill"
				items={massingDisplays}
				bind:value={
					() => massingDisplay,
					(value) => (massingDisplay = value === 'transparency' ? 'transparency' : 'normal')
				}
			/>
			{@render styleSelect()}
			{@render parcelSelect()}
			{#if variant.porosity}<Button label="New seed" onclick={drawSeed} />{/if}
		{:else}
			{#if townResult}
				<p>
					The Town view follows each frontage into the parcel in strips. Doors and steps meet the
					lane, and the wings around a perimeter block share its public court.
				</p>
			{:else}
				<p>
					The parcel is split by the grid rule: one quad per corner through the centre and the edge
					midpoints, once more inside each quad, and storeys of 3.5 m. The house claims cells from
					the alley inward. The innermost ring stays open as the court, and a gate opens the
					shortest way to it.
				</p>
			{/if}
			<p>
				A style is a row of parameters over the same cells. Memphis stacks bold primitive solids in
				flat colour. Archigram raises a grey frame on the cell edges and plugs capsules and services
				into it. Organic rounds every cell into a pod and steps down to a planted court.
			</p>
			{@render styleSelect()}
			{#if townResult}
				<Select
					label="Block"
					items={townBlocks}
					bind:value={() => block, (value) => (block = scopeOf(String(value)))}
				/>
				<ToggleGroup
					label="Styles"
					items={townStyleItems}
					bind:value={
						() => townStyles, (value) => (townStyles = value === 'mixed' ? 'mixed' : 'one')
					}
				/>
				<ToggleGroup
					label="Detail"
					items={detailItems}
					bind:value={() => detail, (value) => (detail = value === 'plain' ? 'plain' : 'salient')}
				/>
			{:else}
				{@render parcelSelect()}
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
		{/if}
	</div>
</section>
