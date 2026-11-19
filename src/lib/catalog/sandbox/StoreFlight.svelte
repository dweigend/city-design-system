<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { sandboxMotion } from '../data/sandbox';
	import type { Vec3 } from '../logic/parametrik/types';
	import { storedModules, type Completion } from './feedback';

	let {
		onCompletion,
		destination,
		project
	}: {
		onCompletion: (listener: (value: Completion) => void) => () => void;
		destination?: HTMLElement;
		project: (point: Vec3) => { x: number; y: number } | undefined;
	} = $props();
	let overlay: HTMLDivElement;
	type Flight = {
		endX: number;
		endY: number;
		points: { x: number; y: number }[];
	};
	let flights = $state.raw<Flight[]>([]);
	const timers = new SvelteSet<ReturnType<typeof setTimeout>>();

	function startFlight(completion: Completion) {
		if (completion.kind !== 'dig' && completion.kind !== 'erase') return;
		if (!destination || !overlay) return;
		const points = storedModules(completion).flatMap((point) => project(point) ?? []);
		if (!points.length) return;
		const target = destination.getBoundingClientRect();
		const local = overlay.getBoundingClientRect();
		const flight = {
			endX: target.x + target.width / 2 - local.x,
			endY: target.y + target.height / 2 - local.y,
			points
		};
		flights = [...flights, flight];
		const timer = setTimeout(() => {
			timers.delete(timer);
			flights = flights.filter((active) => active !== flight);
		}, sandboxMotion.responseMs);
		timers.add(timer);
	}

	function clearFlights() {
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
		flights = [];
	}

	$effect(() => onCompletion(startFlight));
	$effect(() => clearFlights);
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) clearFlights();
	}}
/>
<div
	class="flight"
	bind:this={overlay}
	aria-hidden="true"
	style:--duration="{sandboxMotion.responseMs}ms"
>
	{#each flights as flight (flight)}
		<div style:--end-x="{flight.endX}px" style:--end-y="{flight.endY}px">
			{#each flight.points as { x, y }, index (index)}
				<span class="module" style:--start-x="{x}px" style:--start-y="{y}px"></span>
			{/each}
		</div>
	{/each}
</div>

<style>
	.flight {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.module {
		position: absolute;
		top: calc(-1 * var(--space-2));
		left: calc(-1 * var(--space-2));
		width: var(--space-4);
		height: var(--space-4);
		border: var(--hair) solid var(--blueprint);
		background: var(--paper);
		animation: to-store var(--duration) ease-in-out both;
	}
	@keyframes to-store {
		from {
			transform: translate(var(--start-x), var(--start-y));
		}
		to {
			transform: translate(var(--end-x), var(--end-y)) scale(0.25);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.module {
			display: none;
		}
	}
</style>
