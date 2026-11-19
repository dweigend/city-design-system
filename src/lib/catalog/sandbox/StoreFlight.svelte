<script lang="ts">
	import { sandboxMotion } from '../data/sandbox';
	import type { Vec3 } from '../logic/parametrik/types';
	import { storedModules, type Completion } from './feedback';

	let {
		completion,
		destination,
		project
	}: {
		completion?: Completion;
		destination?: HTMLElement;
		project: (point: Vec3) => { x: number; y: number } | undefined;
	} = $props();
	let overlay: HTMLDivElement;
	let flights = $state.raw<{ x: number; y: number }[]>([]);
	let endX = $state(0);
	let endY = $state(0);

	const returnsModules = new Set(['dig', 'erase']);
	const transfer = $derived(
		completion && returnsModules.has(completion.kind) ? completion : undefined
	);

	function setDestination(element: HTMLElement) {
		const target = element.getBoundingClientRect();
		const local = overlay.getBoundingClientRect();
		endX = target.x + target.width / 2 - local.x;
		endY = target.y + target.height / 2 - local.y;
	}

	$effect(() => {
		flights = [];
		if (!transfer || !destination || !overlay) return;
		setDestination(destination);
		flights = storedModules(transfer).flatMap((point) => project(point) ?? []);
	});
</script>

<svelte:document
	onvisibilitychange={() => {
		if (document.hidden) flights = [];
	}}
/>
<div
	class="flight"
	bind:this={overlay}
	aria-hidden="true"
	style:--end-x="{endX}px"
	style:--end-y="{endY}px"
	style:--duration="{sandboxMotion.responseMs}ms"
>
	{#key completion}
		{#each flights as { x, y }, index (index)}
			<span class="module" style:--start-x="{x}px" style:--start-y="{y}px"></span>
		{/each}
	{/key}
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
