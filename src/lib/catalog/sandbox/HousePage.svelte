<script lang="ts">
	import { Label } from 'bits-ui';
	import RulePlates from './RulePlates.svelte';
	import HouseChoice from './HouseChoice.svelte';
	import Button from '../ui/Button.svelte';
	import { nextSeed } from '../core/random';
	import { envelopePlates } from '../logic/bibel/envelope-plates';
	import { composedHousePlates } from '../logic/bibel/composed-houses';
	import { plotHouse, plotShapes, type PlotShape } from '../logic/bibel/house-plot';
	import { sectionParts } from '../logic/composed-house';
	const examples = [...composedHousePlates(), ...envelopePlates()];
	let shape = $state<PlotShape>('Rectangle'),
		height = $state(4),
		area = $state(240),
		seed = $state(7);
	let requestedShape = $state<PlotShape>('Rectangle');
	let requestedHeight = $state(4),
		requestedArea = $state(240);
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
	text="Generate a painted footprint and compare house sections, ensembles and envelope studies."
	{plates}
	fitView
>
	{#snippet controls()}
		<form
			class="controls"
			onsubmit={(event) => {
				event.preventDefault();
				shape = requestedShape;
				height = requestedHeight;
				area = requestedArea;
				seed = nextSeed(seed);
			}}
		>
			<Label.Root for="house-height">Storeys</Label.Root>
			<input
				id="house-height"
				name="storeys"
				type="number"
				required
				min="1"
				step="1"
				bind:value={requestedHeight}
			/>
			<Label.Root for="house-area">Plot area (m²)</Label.Root>
			<input
				id="house-area"
				name="area"
				type="number"
				required
				min="0.01"
				step="any"
				bind:value={requestedArea}
			/>
			<HouseChoice
				label="Footprint"
				value={requestedShape}
				options={plotShapes}
				onpick={(v) => (requestedShape = v as PlotShape)}
			/>
			<Button label="Regenerate" type="submit" />
		</form>
	{/snippet}
</RulePlates>

<style>
	input {
		width: 7ch;
		box-sizing: content-box;
		font: inherit;
		color: var(--ink);
		background: var(--paper);
		padding: var(--space-2);
		border: var(--hair) solid var(--ink);
	}
	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		margin-bottom: var(--space-4);
	}
</style>
