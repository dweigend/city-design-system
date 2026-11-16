<script lang="ts">
	import { Slider } from 'bits-ui';
	/** Slim slider for the side panel: label on the left, value on the right, hairline with thumb. */
	let {
		label,
		value = $bindable(0),
		min = 0,
		max = 1,
		step = 0.01,
		format = (v: number) => String(v),
		disabled = false
	}: {
		label: string;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		format?: (v: number) => string;
		disabled?: boolean;
	} = $props();
	const pct = $derived(((value - min) / (max - min || 1)) * 100);
</script>

<div class="regler" class:disabled>
	<div class="head"><span>{label}</span><output>{format(value)}</output></div>
	<Slider.Root
		type="single"
		bind:value
		{min}
		{max}
		{step}
		{disabled}
		class="track"
		aria-label={label}
	>
		{#snippet children({ thumbItems })}
			<span class="line"><span class="fill" style:width="{pct}%"></span></span>
			{#each thumbItems as t (t.index)}<Slider.Thumb
					index={t.index}
					class="thumb"
					aria-label={label}
					aria-valuetext={format(value)}
				/>{/each}
		{/snippet}
	</Slider.Root>
</div>

<style>
	.regler {
		display: grid;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.disabled {
		opacity: 0.45;
	}
	.head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		color: var(--ink-2);
	}
	output {
		color: var(--ink);
	}
	.regler :global(.track) {
		position: relative;
		display: flex;
		align-items: center;
		height: var(--ctl-s);
		touch-action: none;
		cursor: pointer;
	}
	.line {
		position: absolute;
		left: 0;
		right: 0;
		height: var(--hair);
		background: var(--line);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--ink);
	}
	.regler :global(.thumb) {
		display: block;
		width: 10px;
		height: 10px;
		background: var(--paper);
		border: var(--hair) solid var(--ink);
		border-radius: 50%;
	}
	.regler :global(.thumb:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
