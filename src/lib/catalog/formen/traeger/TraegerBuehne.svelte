<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { zeichneSzene, hausLeitstil, hatHausLeitstil } from '../../scene/leitstil';
	import { stilFuer } from '../../logic/leitstil';
	import { theme } from '../../theme';
	import { createTraegerSzene, type Blick, type PlatzierterPlan } from '../../scene/traeger';
	import { readPalette } from '../../scene/themeBinding';
	import type { View } from '../../scene/parametrik';
	import type { Primitive } from '../../logic/parametrik/types';
	import type { Ansicht, Vec3 } from '../../logic/traeger';
	import type { Analyse } from '../../logic/haus-tragwerk';
	let {
		plaene,
		leitstil = false,
		bestand = [],
		hochweg = [],
		figuren,
		ansicht = 'geruest',
		figur,
		view,
		analyse,
		analyseVeraltet = false,
		blick,
		drehbar = true,
		verhaeltnis = '4 / 3',
		mobilVerhaeltnis = '4 / 3',
		label
	}: {
		plaene: PlatzierterPlan[];
		leitstil?: boolean;
		bestand?: Primitive[];
		hochweg?: Primitive[];
		figuren?: Vec3[];
		ansicht?: Ansicht;
		figur?: Vec3;
		view?: View;
		/** Result view of the structural simulation; replaces the ink drawing of the struts. */
		analyse?: Analyse;
		/** The analysis belongs to a superseded state and steps back until the new one is there. */
		analyseVeraltet?: boolean;
		/** Starting direction of the camera; if omitted, the shared isometric view. */
		blick?: Blick;
		drehbar?: boolean;
		verhaeltnis?: string;
		mobilVerhaeltnis?: string;
		label: string;
	} = $props();
	let host: HTMLDivElement;
	let canvas = $state<HTMLCanvasElement>();
	let leitstilHost = $state<HTMLDivElement>();
	const zeichnetLeitstil = $derived(
		leitstil && !analyse && !!plaene[0]?.haus && hatHausLeitstil(plaene[0].haus)
	);
	let nah = $state(false),
		fehler = $state('');
	let scene = $state<ReturnType<typeof createTraegerSzene>>();
	export function reset() {
		scene?.reset();
	}
	onMount(() => {
		const io = new IntersectionObserver(([e]) => (nah = e.isIntersecting), { rootMargin: '200px' });
		io.observe(host);
		return () => io.disconnect();
	});
	$effect(() => {
		if (!nah || zeichnetLeitstil || !canvas) return;
		try {
			const current = createTraegerSzene(
				canvas,
				readPalette(host),
				() => (fehler = '3D view unavailable.'),
				drehbar
			);
			scene = current;
			fehler = '';
			void current.ready.catch(() => {});
			const ro = new ResizeObserver(() => {
				if (canvas) current.resize(canvas.clientWidth, canvas.clientHeight);
			});
			ro.observe(host);
			return () => {
				ro.disconnect();
				current.dispose();
				untrack(() => (scene = undefined));
			};
		} catch (e) {
			console.error(e);
			fehler = '3D view unavailable.';
		}
	});
	$effect(() => {
		if (!nah || !zeichnetLeitstil || !leitstilHost) return;
		const haus = plaene[0]?.haus;
		if (!haus) return;
		try {
			const stil = stilFuer({
				zoom: 'haus',
				modus: 'ansehen',
				situation: 'normal',
				thema: theme.mode === 'dark' ? 'dunkel' : 'hell'
			});
			const current = zeichneSzene(hausLeitstil(haus, ansicht), stil, leitstilHost);
			leitstilHost.querySelector('canvas')?.setAttribute('aria-label', label);
			fehler = '';
			return () => current.dispose();
		} catch (e) {
			console.error(e);
			fehler = '3D view unavailable.';
		}
	});

	let previous = '';
	let previousScene: ReturnType<typeof createTraegerSzene> | undefined;
	$effect(() => {
		const current = scene;
		if (!current) return;
		const signature = JSON.stringify([
			plaene.map((e) => [
				e.plan.familie,
				e.plan.saat,
				e.plan.knoten.map((n) => n.id),
				e.plan.kanten,
				e.plan.flaechen,
				e.plan.zellen.map((z) => [z.id, z.flaechen, z.nutzung]),
				e.plan.belegung,
				e.haus,
				e.lage,
				e.fokus
			]),
			bestand,
			hochweg,
			figuren,
			figur,
			view,
			analyse,
			analyseVeraltet,
			blick
		]);
		if (signature === previous && current === previousScene) {
			for (const e of plaene) current.aktualisiere(e.plan);
		} else {
			current.setze(
				plaene,
				bestand,
				untrack(() => ansicht),
				{ figur, figuren, hochweg, view, analyse, analyseVeraltet, blick }
			);
			previous = signature;
			previousScene = current;
		}
	});
	$effect(() => {
		scene?.ansicht(ansicht);
	});
</script>

<div
	class="buehne"
	bind:this={host}
	style:--verhaeltnis={verhaeltnis}
	style:--mobil-verhaeltnis={mobilVerhaeltnis}
>
	{#if zeichnetLeitstil}
		<div class="leitstil" bind:this={leitstilHost}></div>
	{:else}
		<canvas bind:this={canvas} tabindex={drehbar ? 0 : undefined} class:drehbar aria-label={label}
		></canvas>
	{/if}
	{#if fehler}<p role="status">{fehler}</p>{/if}
</div>

<style>
	.buehne {
		aspect-ratio: var(--verhaeltnis);
		position: relative;
		width: 100%;
		min-width: 0;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		overflow: hidden;
	}
	.leitstil {
		width: 100%;
		height: 100%;
	}
	.leitstil :global(canvas) {
		display: block;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	canvas.drehbar {
		touch-action: none;
	}
	canvas:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	p {
		position: absolute;
		inset: var(--space-4);
		color: var(--ink-2);
	}
	@media (max-width: 720px) {
		.buehne {
			aspect-ratio: var(--mobil-verhaeltnis);
		}
	}
</style>
