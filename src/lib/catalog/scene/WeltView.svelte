<script lang="ts">
	import { observeSceneVisibility, observeSceneSize } from './scene-visibility.svelte';
	import { readPalette } from '../scene/themeBinding';
	import { createWeltScene, type WeltEbene, type WeltInput, type WeltMode } from './welt';
	let {
		world,
		mode = 'plan',
		tour = 0,
		ebene = 'boden',
		glas = false,
		label
	}: {
		world: WeltInput;
		mode?: WeltMode;
		tour?: number;
		ebene?: WeltEbene;
		glas?: boolean;
		label: string;
	} = $props();
	let host: HTMLDivElement;
	let canvas = $state<HTMLCanvasElement>();
	let mounted = $state(false),
		error = $state('');
	let scene = $state<ReturnType<typeof createWeltScene>>();
	observeSceneVisibility(
		() => host,
		'300px',
		(visible) => {
			if (visible) mounted = true;
		}
	);
	$effect(() => {
		if (!mounted || !canvas) return;
		error = '';
		try {
			const current = createWeltScene(canvas, readPalette(host), () => {
				error = '3D view unavailable.';
			});
			const stopResize = observeSceneSize(host, canvas, current);
			scene = current;
			return () => {
				stopResize();
				current.dispose();
				scene = undefined;
			};
		} catch (cause) {
			console.error(cause);
			error = '3D view unavailable.';
		}
	});
	$effect(() => {
		scene?.update(world);
	});
	$effect(() => {
		scene?.setGlas(glas);
	});
	$effect(() => {
		scene?.setEbene(ebene);
	});
	$effect(() => {
		scene?.setMode(mode);
	});
	$effect(() => {
		scene?.setTour(tour);
	});
	/** One step (meters) and one turn (radians) for buttons and touch. */
	export function step(forward: number, turn = 0) {
		scene?.step(forward, turn);
	}
	export function reset() {
		scene?.reset();
	}
</script>

<div class="view" bind:this={host} data-mode={mode}>
	<canvas bind:this={canvas} tabindex="0" aria-label={label}></canvas>
	{#if error}<p role="status">{error}</p>{/if}
</div>

<style>
	.view {
		position: relative;
		min-width: 0;
		height: 680px;
		border: var(--hair) solid var(--line);
		cursor: grab;
		overflow: hidden;
	}
	.view:active {
		cursor: grabbing;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	canvas:focus-visible {
		outline-offset: -4px;
	}
	p {
		position: absolute;
		inset: var(--space-4);
	}
	@media (max-width: 720px) {
		.view {
			height: 420px;
		}
	}
</style>
