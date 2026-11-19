<script lang="ts">
	import { Slider, Meter } from 'bits-ui';
	import Tooltip from './Tooltip.svelte';
	// The thumb is a value tag (global class .cg-tag from Tag.svelte).
	import './Tag.svelte';
	import { pct, ticks, labelValues, type Marker, type Segment } from '../data/scale';

	/**
	 * One scale for slider, metric and timeline.
	 * input → Bits Slider (operable), readout → Bits Meter (display).
	 * The value tag is also the thumb.
	 */
	let {
		mode = 'input',
		live = false,
		label,
		caption = true,
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		track = 'line',
		minor,
		major,
		markers = [],
		markerShape = 'square',
		segments = [],
		format = (v: number) => String(v),
		detail
	}: {
		mode?: 'input' | 'readout';
		live?: boolean;
		label: string;
		/** Show a heading above the scale (aria-label always stays). */
		caption?: boolean;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		track?: 'line' | 'bar';
		minor?: number;
		major?: number;
		markers?: Marker[];
		markerShape?: 'square' | 'dot';
		segments?: Segment[];
		format?: (v: number) => string;
		detail?: string;
	} = $props();

	const p = (v: number) => pct(v, min, max);

	// Drag freely, snap to the step on release.
	const snap = (v: number) =>
		Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
	// Follows value, is freely overwritten while dragging (writable $derived).
	let raw = $derived(value);
	let snapping = $state(false);
	const shown = $derived(snap(raw));
	function commit(v: number) {
		snapping = true;
		value = raw = snap(v);
		setTimeout(() => (snapping = false), 160);
	}
	function onkeydown(e: KeyboardEvent) {
		const keys: Record<string, number> = {
			ArrowRight: step,
			ArrowUp: step,
			ArrowLeft: -step,
			ArrowDown: -step,
			PageUp: step * 10,
			PageDown: -step * 10
		};
		if (e.key in keys) commit(shown + keys[e.key]);
		else if (e.key === 'Home') commit(min);
		else if (e.key === 'End') commit(max);
		else return;
		e.preventDefault();
	}
	const tickList = $derived(minor ? ticks(min, max, minor, major ?? minor) : []);
	const labels = $derived(labelValues(min, max, major, segments));
</script>

{#snippet body()}
	<span class="line"><span class="fill" style:width="{p(raw)}%"></span></span>
	{#each tickList as t (t.value)}<span
			class="tick"
			class:major={t.major}
			class:past={t.value <= shown}
			style:left="{p(t.value)}%"
		></span>{/each}
	{#each segments as s (s.from)}<span class="bound" style:left="{p(s.from)}%"></span>{/each}
{/snippet}

<div
	class="scale"
	data-track={track}
	data-mode={mode}
	data-marker-shape={markerShape}
	class:snapping
>
	{#if caption || segments.length}
		<div class="row head">
			{#if segments.length}
				{#each segments as s (s.from)}
					<span class="seg" class:active={shown >= s.from} style:left="{p(s.from)}%"
						><span class="idx">{s.index}</span>{s.label}</span
					>
				{/each}
			{:else}
				<span class="label">{label}</span>
			{/if}
		</div>
	{/if}

	{#if markers.length}
		<div class="row marks">
			{#each markers as m (m.value)}
				<Tooltip text="{format(m.value)} · {m.label}">
					{#snippet trigger(props)}
						<button
							{...props}
							class="mark"
							class:future={m.value > shown}
							class:dot={markerShape === 'dot'}
							class:future-dot={markerShape === 'dot' && m.value > shown}
							style:left="{p(m.value)}%"
							style:--c={m.color}
							aria-label="{format(m.value)}: {m.label}"
						></button>
					{/snippet}
				</Tooltip>
			{/each}
		</div>
	{/if}

	{#if mode === 'input'}
		<Slider.Root
			type="single"
			bind:value={raw}
			{min}
			{max}
			step={live ? step : (max - min) / 1000}
			onValueChange={(v) => {
				if (live) value = snap(v);
			}}
			onValueCommit={commit}
			thumbPositioning="exact"
			class="row body"
			aria-label={label}
		>
			{#snippet children({ thumbItems })}
				{@render body()}
				{#each thumbItems as t (t.index)}<Slider.Thumb
						index={t.index}
						class="handle cg-tag"
						style="--at: {p(raw)}"
						aria-label={label}
						aria-valuetext={format(shown)}
						{onkeydown}>{format(shown)}</Slider.Thumb
					>{/each}
			{/snippet}
		</Slider.Root>
	{:else}
		<Meter.Root {value} {min} {max} class="row body" aria-label={label}>
			{@render body()}
			<Tooltip text={detail ?? `${format(value)} of ${format(max)}`}>
				{#snippet trigger(props)}<button
						{...props}
						class="handle cg-tag"
						style:left="{p(value)}%"
						style:--at={p(value)}>{format(value)}</button
					>{/snippet}
			</Tooltip>
		</Meter.Root>
	{/if}

	<div class="row nums">
		{#each labels as v (v)}<span style:left="{p(v)}%">{format(v)}</span>{/each}
	</div>
</div>

<style>
	/* Four rows of 20 px (module): header · marks · line · numbers */
	.scale {
		--row: var(--ctl-s);
		display: flex;
		flex-direction: column;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.row {
		position: relative;
		height: var(--row);
	}
	/* The header row follows the control variables (bibel/DemoLayout); the numbers stay mono. */
	.head {
		display: flex;
		align-items: center;
		font-family: var(--steuer-schrift, inherit);
		font-size: var(--steuer-groesse, inherit);
		text-transform: var(--steuer-versal, uppercase);
		color: var(--ink-2);
	}
	.seg {
		position: absolute;
		display: flex;
		gap: var(--space-1);
		padding-left: var(--space-2);
		white-space: nowrap;
		color: var(--ink-3);
	}
	.seg.active {
		color: var(--ink);
	}
	.idx {
		color: inherit;
		opacity: 0.6;
	}

	.mark {
		position: absolute;
		bottom: var(--space-1);
		width: var(--space-2);
		height: var(--space-2);
		padding: 0;
		border: 0;
		background: var(--c);
		transform: translateX(-50%);
		cursor: help;
	}
	.mark.future {
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--hair) var(--c);
	}

	[data-marker-shape='dot'] .marks {
		z-index: 1;
		transform: translateY(var(--row));
		pointer-events: none;
	}
	.mark.dot {
		bottom: 50%;
		width: 24px;
		height: 24px;
		transform: translate(-50%, 50%);
		background: none;
		box-shadow: none;
		pointer-events: auto;
	}
	.dot::after {
		content: '';
		display: block;
		margin: auto;
		width: var(--space-2);
		height: var(--space-2);
		border-radius: 50%;
		background: var(--c);
	}
	.future-dot::after {
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--hair) var(--c);
	}

	.scale :global(.body) {
		position: relative;
		display: block;
		width: 100%;
		height: var(--row);
		touch-action: none;
	}
	.scale[data-mode='input'] :global(.body) {
		cursor: pointer;
	}
	.line {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: var(--hair);
		background: var(--ink-3);
	}
	.fill {
		position: absolute;
		left: 0;
		top: -0.5px;
		height: var(--stroke);
		background: var(--ink);
	}
	[data-track='bar'] .line {
		height: var(--bar);
		top: calc(50% - var(--bar) / 2);
		background: var(--paper-3);
	}
	[data-track='bar'] .fill {
		top: 0;
		height: 100%;
	}
	.tick {
		position: absolute;
		top: calc(50% + 1px);
		width: var(--hair);
		height: var(--space-1);
		background: var(--ink-3);
		transform: translateX(-50%);
	}
	.tick.major {
		height: var(--space-2);
	}
	.tick.past {
		background: var(--ink);
	}
	.bound {
		position: absolute;
		top: 0;
		bottom: 0;
		width: var(--stroke);
		background: var(--ink);
		transform: translateX(-50%);
	}

	/*
	 * Thumb: value tag, 16 px high, centered in the 20 px row.
	 * The tag's anchor slides with the value (--at, 0–100): at the start its left edge,
	 * at the end its right edge sits on the value, like the end numbers below. So the tag
	 * never leaves the track. Bits centers its thumb (translate -50%); the readout tag does
	 * the same, and the transform moves the anchor from the center to --at.
	 */
	.scale :global(.handle) {
		--tag-h: var(--space-4);
		position: absolute;
		top: calc((var(--row) - var(--tag-h)) / 2);
		translate: -50% 0;
		transform: translateX(calc((50 - clamp(0, var(--at), 100)) * 1%));
		cursor: inherit;
	}
	.scale[data-mode='readout'] :global(.handle) {
		cursor: help;
	}
	.snapping :global(.handle) {
		transition:
			left var(--fast) var(--ease),
			transform var(--fast) var(--ease);
	}
	.snapping .fill {
		transition: width var(--fast) var(--ease);
	}

	.nums {
		color: var(--ink-2);
	}
	.nums span {
		position: absolute;
		top: 2px;
		white-space: nowrap;
		transform: translateX(-50%);
	}
	.nums span:first-child {
		transform: none;
	}
	.nums span:last-child {
		transform: translateX(-100%);
	}
</style>
