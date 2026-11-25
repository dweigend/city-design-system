<script lang="ts">
	import { defaults } from '../../../config/slider';
	import { Slider as Primitive } from 'bits-ui';

	interface Props {
		/** Visible ruler label, for example "Height". */
		label: string;
		/** First value on the ruler, for example 0. */
		min: number;
		/** Last value on the ruler, for example 10. */
		max: number;
		/** Distance between ticks and arrow-key changes, for example 1. */
		step: number;
		/** Bind the current number, for example bind:value={height}. */
		value: number;
		/** Called when pointer or keyboard adjustment is committed. */
		onCommit?: (value: number) => void;
	}

	const id = $props.id();
	const readValue = new Intl.NumberFormat('en', {
		maximumFractionDigits: defaults.sliderValueFractionDigits,
		useGrouping: false
	});
	let { label, min, max, step, value = $bindable(), onCommit }: Props = $props();
</script>

<div class="control-slider-field">
	<span class="label" {id}>{label}</span>
	<Primitive.Root
		class="control-slider"
		type="single"
		thumbPositioning="exact"
		onValueCommit={onCommit}
		{min}
		{max}
		{step}
		bind:value
	>
		{#snippet children({ tickItems })}
			<span class="control-slider-track"></span>
			{#each tickItems as tick (tick.index)}
				<Primitive.Tick class="control-slider-tick" index={tick.index} />
			{/each}
			<Primitive.Thumb
				class="control-slider-thumb"
				aria-labelledby={id}
				index={/* Exact arithmetic: the only slider thumb is first. */ 0}
			>
				<span class="tag" aria-hidden="true">{readValue.format(value)}</span>
			</Primitive.Thumb>
		{/snippet}
	</Primitive.Root>
	<div class="control-slider-axis data" aria-hidden="true">
		<span>{min}</span><span>{max}</span>
	</div>
</div>
