<script lang="ts">
	import { Meter } from 'bits-ui';
	/**
	 * Live metric as a Bits Meter: value on an axis, optionally with a reference range.
	 * Inside the range: ink. Outside: signal.
	 */
	let {
		label,
		value,
		min,
		max,
		band,
		format = (v: number) => v.toFixed(2)
	}: {
		label: string;
		value: number;
		min: number;
		max: number;
		band?: readonly [number, number];
		format?: (v: number) => string;
	} = $props();
	const p = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
	const innen = $derived(!band || (value >= band[0] && value <= band[1]));
	const text = $derived(
		band
			? `${format(value)}, old towns ${format(band[0])}–${format(band[1])}, ${innen ? 'inside' : 'outside'}`
			: format(value)
	);
</script>

<div class="wert" class:aussen={!innen}>
	<div class="kopf">
		<span>{label}</span>
		<output>{format(value)}</output>
	</div>
	<Meter.Root
		value={Math.max(min, Math.min(max, value))}
		{min}
		{max}
		aria-label={label}
		aria-valuetext={text}
		class="achse"
	>
		{#if band}<span class="band" style:left="{p(band[0])}%" style:width="{p(band[1]) - p(band[0])}%"
			></span>{/if}
		<span class="marke" style:left="{p(value)}%"></span>
	</Meter.Root>
	{#if band}<div class="fuss">Old towns {format(band[0])}–{format(band[1])}</div>{/if}
</div>

<style>
	.wert {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		min-width: 0;
	}
	.kopf {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		color: var(--ink-2);
	}
	output {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.aussen output {
		color: var(--signal);
	}
	.wert :global(.achse) {
		position: relative;
		display: block;
		height: var(--space-3);
		border-bottom: var(--hair) solid var(--ink-3);
	}
	.band {
		position: absolute;
		bottom: 0;
		height: var(--space-2);
		background: var(--paper-3);
		box-shadow: inset 0 0 0 var(--hair) var(--ink-3);
	}
	.marke {
		position: absolute;
		bottom: calc(-1 * var(--space-1));
		width: var(--stroke);
		height: var(--space-4);
		background: var(--ink);
		transform: translateX(-50%);
	}
	.aussen .marke {
		background: var(--signal);
	}
	.fuss {
		color: var(--ink-3);
	}
</style>
