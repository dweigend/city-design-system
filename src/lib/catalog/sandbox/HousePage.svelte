<script lang="ts">
	import RulePlates from './RulePlates.svelte';
	import HouseChoice from './HouseChoice.svelte';
	import Button from '../ui/Button.svelte';
	import { nextSeed } from '../core/random';
	import { composedHousePlates } from '../logic/bibel/composed-houses';
	import { plotHouse, plotShapes, type PlotShape } from '../logic/bibel/house-plot';
	import { sectionParts } from '../logic/composed-house';
	const examples = composedHousePlates();
	let shape = $state<PlotShape>('Rectangle'),
		height = $state('4'),
		area = $state('240'),
		seed = $state(7);
	const plates = $derived([
		{
			id: 'generated',
			title: 'Generated house',
			text: height + ' storeys · ' + area + ' m² · Seed ' + seed,
			primitives: sectionParts(plotHouse(Number(height), Number(area), shape, seed))
		},
		...examples
	]);
</script>

<RulePlates
	title="Composed houses"
	text="Generate a painted footprint or compare the five reference sections."
	{plates}
	fitView
>
	{#snippet controls()}
		<div class="controls">
			<HouseChoice
				label="Storeys"
				value={height}
				options={Array.from({ length: 32 }, (_, i) => String(i + 1))}
				onpick={(v) => (height = v)}
			/>
			<HouseChoice
				label="Plot area (m²)"
				value={area}
				options={['64', '120', '240', '480', '960']}
				onpick={(v) => (area = v)}
			/>
			<HouseChoice
				label="Footprint"
				value={shape}
				options={plotShapes}
				onpick={(v) => (shape = v as PlotShape)}
			/>
			<Button label="Regenerate" onclick={() => (seed = nextSeed(seed))} />
		</div>
	{/snippet}
</RulePlates>

<style>
	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		margin-bottom: var(--space-4);
	}
</style>
