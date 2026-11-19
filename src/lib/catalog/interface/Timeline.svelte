<script lang="ts">
	import { flowToken, type FlowId } from '../data/focus';
	import { hudZeit } from '../data/interface';
	import Scale from '../ui/Scale.svelte';

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
		labelEvery = hudZeit.major
	}: {
		mode?: 'input' | 'readout';
		caption?: boolean;
		min?: number;
		max?: number;
		year?: number;
		events?: readonly Event[];
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
