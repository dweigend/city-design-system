<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { LoopUhr, phaseBei } from '../bibel/loopUhr.svelte';
	import { teilungsBild } from './bilder';
	import { createRasterBuehne, type RasterBuehne } from '../scene/rasterBuehne';
	import { teile, teilformen, teilungsBild as zeitplan } from '../logic/bibel/viereckteilung';
	import { teilungPhasen } from '../data/raster';

	/**
	 * Explainer loop: set the center, halve the edges, connect. One shape per phase, finally three
	 * neighbors with shared edge midpoints. The image is a pure function of the clock time.
	 * With reduced motion each phase stands still, fully built.
	 */
	const DAUER = 5.5;
	const teilungen = teilformen.map((f) => teile(f.polygone));
	/** Without motion each phase stands at this point: fully built, without lift. */
	const STILL = 0.66;
	const uhr = new LoopUhr(true, STILL * DAUER);

	const stand = $derived(phaseBei(uhr.sekunden, teilungPhasen.length, DAUER));
	const bild = $derived(teilungsBild(teilungen[stand.index], zeitplan(stand.anteil)));

	let canvas: HTMLCanvasElement;
	let host: HTMLDivElement;
	let buehne = $state<RasterBuehne>();
	let fehler = $state('');

	onMount(() => {
		const io = new IntersectionObserver(([e]) => (uhr.sichtbar = e.isIntersecting), {
			rootMargin: '100px'
		});
		io.observe(host);
		let aktuell: RasterBuehne | undefined;
		try {
			aktuell = createRasterBuehne(
				canvas,
				{ extent: 12.5, hoeheDeg: 68, azimutDeg: 12 },
				{ onError: () => (fehler = '3D view unavailable.') }
			);
			void aktuell.ready.catch(() => {});
			buehne = aktuell;
		} catch (cause) {
			console.error(cause);
			fehler = '3D view unavailable.';
		}
		const ro = new ResizeObserver(() => aktuell?.resize(canvas.clientWidth, canvas.clientHeight));
		ro.observe(canvas);
		return () => {
			io.disconnect();
			ro.disconnect();
			uhr.stopp();
			aktuell?.dispose();
			buehne = undefined;
		};
	});

	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});
	$effect(() => {
		buehne?.zeige(bild);
	});

	function waehle(i: number) {
		uhr.sekunden = (i + (uhr.laeuft ? 0 : STILL)) * DAUER;
	}
</script>

<DemoLayout label="Quad subdivision">
	{#snippet bild()}
		<div class="stage" bind:this={host}>
			<canvas
				bind:this={canvas}
				aria-label="{teilungPhasen[stand.index].titel}: {teilungPhasen[stand.index].text}"
			></canvas>
			{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
		</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte
			id="viereck-loop"
			label="Subdivision"
			phasen={teilungPhasen}
			index={stand.index}
			anteil={stand.anteil}
			laeuft={uhr.laeuft}
			onwahl={waehle}
			onumschalten={() => (uhr.laeuft = !uhr.laeuft)}
		/>
	{/snippet}
</DemoLayout>

<style>
	.stage {
		position: relative;
		border: var(--hair) solid var(--line);
		background: var(--paper);
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
