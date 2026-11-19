<script lang="ts">
	import { flowToken, type FlowId } from '../data/focus';
	import { hudZeit } from '../data/interface';
	import Scale from '../ui/Scale.svelte';
	import Tooltip from '../ui/Tooltip.svelte';

	type Event = { year: number; label: string; flows: readonly FlowId[] };

	const sample = hudZeit.ereignisse.map(({ jahr, text, strom }) => ({
		year: jahr,
		label: text,
		flows: [strom]
	}));
	let {
		mode = 'readout',
		caption = false,
		min = hudZeit.min,
		max = hudZeit.max,
		year = hudZeit.value,
		events = sample,
		stockYear,
		labelEvery = hudZeit.major
	}: {
		mode?: 'input' | 'readout';
		caption?: boolean;
		min?: number;
		max?: number;
		year?: number;
		events?: readonly Event[];
		stockYear?: number;
		labelEvery?: number | false;
	} = $props();

	function eventColor(flows: readonly FlowId[]) {
		const colors = flows.map((flow) => `var(${flowToken[flow]})`);
		if (colors.length <= 1) return colors[0] ?? 'var(--ink-2)';
		const stops = colors.map((color, i) => {
			const width = 100 / colors.length;
			return `${color} ${i * width}% ${(i + 1) * width}%`;
		});
		return `linear-gradient(to right, ${stops.join(', ')})`;
	}

	const markers = $derived(
		events.map(({ year: value, label, flows }) => ({ value, label, color: eventColor(flows) }))
	);
</script>

<div class="timeline">
	{#if stockYear !== undefined}
		<div class="stock">
			<div class="stock-line">
				<Tooltip text={`${stockYear} · Existing stock`}>
					{#snippet trigger(props)}
						<button {...props} type="button" aria-label={`${stockYear} · Existing stock`}></button>
					{/snippet}
				</Tooltip>
			</div>
			<span aria-hidden="true">{stockYear}</span>
		</div>
	{/if}
	<div class="axis">
		<Scale
			{mode}
			{caption}
			label={hudZeit.label}
			{min}
			{max}
			value={year}
			minor={hudZeit.major}
			major={labelEvery || undefined}
			{markers}
			markerShape="dot"
			detail={`${hudZeit.label} ${year}`}
		/>
	</div>
</div>

<style>
	.timeline {
		display: flex;
		align-items: end;
	}
	.axis {
		flex: 1;
		min-width: 0;
	}
	.stock {
		width: var(--space-12);
		height: calc(2 * var(--ctl-s));
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	.stock-line {
		position: relative;
		display: flex;
		align-items: center;
		height: var(--ctl-s);
	}
	.stock-line::before {
		content: '';
		width: 100%;
		border-top: var(--hair) solid var(--ink-3);
	}
	.stock-line button {
		position: absolute;
		left: 0;
		width: var(--space-6);
		height: var(--space-6);
		padding: 0;
		border: none;
		background: none;
		cursor: help;
	}
	.stock-line button::after {
		content: '';
		display: block;
		width: var(--space-2);
		height: var(--space-2);
		border-radius: 50%;
		background: var(--ink-2);
	}
	.stock span {
		display: block;
		padding-top: 2px;
	}
</style>
