<script lang="ts">
	import { onMount } from 'svelte';
	import { createMaterialBuehne, type MaterialBuehne } from '../scene/materialBuehne';
	import type { Stueck } from '../logic/material/formen';

	/**
	 * Canvas of a material stage. Starts only when it comes near the window;
	 * animated materials run only while it is visible. The pieces come ready-made from
	 * logic/material/formen.ts.
	 */
	let {
		stuecke,
		label,
		drehen = false,
		verhaeltnis = '16 / 10',
		hoeheDeg = 28,
		azimutDeg = 32,
		rand = 0.12,
		rahmen = true,
		bewegung = true
	}: {
		stuecke: Stueck[];
		label: string;
		drehen?: boolean;
		/** Aspect ratio of the canvas (CSS aspect-ratio). */
		verhaeltnis?: string;
		hoeheDeg?: number;
		azimutDeg?: number;
		rand?: number;
		/** Hairline around the stage. */
		rahmen?: boolean;
		/** Let animated materials (water) run. */
		bewegung?: boolean;
	} = $props();

	let canvas: HTMLCanvasElement;
	let host: HTMLDivElement;
	let buehne = $state<MaterialBuehne>();
	let fehler = $state('');

	export function zuruecksetzen() {
		buehne?.zuruecksetzen();
	}

	onMount(() => {
		let aktuell: MaterialBuehne | undefined;
		const ro = new ResizeObserver(() => aktuell?.resize(canvas.clientWidth, canvas.clientHeight));
		const io = new IntersectionObserver(
			([e]) => {
				aktuell?.setAktiv(e.isIntersecting);
				if (!e.isIntersecting || aktuell) return;
				try {
					aktuell = createMaterialBuehne(canvas, {
						drehen,
						hoeheDeg,
						azimutDeg,
						rand,
						bewegung,
						onError: () => (fehler = '3D view unavailable.')
					});
					void aktuell.ready.catch(() => {});
					aktuell.resize(canvas.clientWidth, canvas.clientHeight);
					buehne = aktuell;
					ro.observe(canvas);
				} catch (cause) {
					console.error(cause);
					fehler = '3D view unavailable.';
				}
			},
			{ rootMargin: '200px' }
		);
		io.observe(host);
		return () => {
			io.disconnect();
			ro.disconnect();
			aktuell?.dispose();
			buehne = undefined;
		};
	});

	$effect(() => {
		buehne?.zeige(stuecke);
	});
</script>

<div class="stage" class:rahmen bind:this={host}>
	<canvas
		bind:this={canvas}
		class:drehen
		tabindex={drehen ? 0 : undefined}
		aria-label={label}
		style:aspect-ratio={verhaeltnis}
	></canvas>
	{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
</div>

<style>
	.stage {
		position: relative;
		background: var(--paper);
	}
	.rahmen {
		border: var(--hair) solid var(--line);
	}
	canvas {
		display: block;
		width: 100%;
	}
	.drehen {
		touch-action: none;
		cursor: grab;
	}
	.drehen:active {
		cursor: grabbing;
	}
	canvas:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: -2px;
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
