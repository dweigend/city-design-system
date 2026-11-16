<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import Scale from '../ui/Scale.svelte';
	import Bildleiste from './Bildleiste.svelte';
	import {
		anziehung,
		feldlinien,
		glyphen,
		isolinien,
		richtungsfeld,
		sdf,
		segmente,
		type Turm
	} from '../logic/modellierung/feld';
	import type { Punkt } from '../logic/modellierung/netz';
	import { feldHinweis, feldModi, type FeldModus } from '../data/wachstum';

	/**
	 * Fields steer, they do not decide. Three modes on an area of 100 × 100 m: direction
	 * (strokes and field lines), distance (soft circles, isolines) and attraction (a point draws
	 * height; replaces the former attractor field). The source can be dragged or moved with arrow
	 * keys; without intervention it stands where the seed places it.
	 */
	const START = { modus: 'richtung' as FeldModus, wirbel: 60, glaettung: 10, radius: 26, saat: 5 };
	let modus = $state<string>(START.modus),
		wirbel = $state(START.wirbel),
		glaettung = $state(START.glaettung),
		radius = $state(START.radius),
		saat = $state(START.saat),
		gezogen = $state<Punkt | undefined>(undefined),
		offen = $state('feld');

	const saatQuelle = $derived<Punkt>(richtungsfeld({ saat, wirbel: 0 }).kern);
	const quelle = $derived<Punkt>(gezogen ?? saatQuelle);
	const info = $derived(feldModi.find((m) => m.id === modus) ?? feldModi[0]);

	const pfeile = $derived(segmente(glyphen({ saat, wirbel: wirbel / 100, kern: quelle })));
	const linien = $derived(segmente(feldlinien({ saat, wirbel: wirbel / 100 })));
	const feld = $derived(sdf(saat, glaettung, quelle));
	const nullLinie = $derived(segmente(isolinien(feld, 0)));
	const stufen = $derived([-8, -4, 4, 8, 12, 16].map((s) => segmente(isolinien(feld, s))).join(''));
	const tuerme = $derived(anziehung(quelle, { radius }));

	/** Oblique view from the front: height in m rises by K units per meter upward. */
	const K = 0.42;
	function turmPfade(t: Turm) {
		const s = t.seite / 2,
			h = t.hoehe * K;
		const [x0, x1, y0, y1] = [t.x - s, t.x + s, t.y - s, t.y + s];
		return {
			front: `M${x0} ${y1}L${x1} ${y1}L${x1} ${y1 - h}L${x0} ${y1 - h}Z`,
			dach: `M${x0} ${y0 - h}L${x1} ${y0 - h}L${x1} ${y1 - h}L${x0} ${y1 - h}Z`
		};
	}

	let svg: SVGSVGElement;
	let zieht = false;
	function ort(e: PointerEvent): Punkt | undefined {
		const m = svg.getScreenCTM();
		if (!m) return;
		const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
		return [Math.max(0, Math.min(100, p.x)), Math.max(0, Math.min(100, p.y))];
	}
	function runter(e: PointerEvent) {
		zieht = true;
		svg.setPointerCapture(e.pointerId);
		gezogen = ort(e) ?? gezogen;
	}
	function bewegen(e: PointerEvent) {
		if (zieht) gezogen = ort(e) ?? gezogen;
	}
	function los(e: PointerEvent) {
		zieht = false;
		if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
	}
	function taste(e: KeyboardEvent) {
		const d: Record<string, Punkt> = {
			ArrowLeft: [-2, 0],
			ArrowRight: [2, 0],
			ArrowUp: [0, -2],
			ArrowDown: [0, 2]
		};
		const v = d[e.key];
		if (!v) return;
		e.preventDefault();
		gezogen = [
			Math.max(0, Math.min(100, quelle[0] + v[0])),
			Math.max(0, Math.min(100, quelle[1] + v[1]))
		];
	}
	function zuruecksetzen() {
		modus = START.modus;
		wirbel = START.wirbel;
		glaettung = START.glaettung;
		radius = START.radius;
		saat = START.saat;
		gezogen = undefined;
		offen = 'feld';
	}
	const meter = (v: number) => `${Math.round(v)} m`;
	const prozent = (v: number) => `${Math.round(v)} %`;
	const ganz = (p: Punkt) => `${Math.round(p[0])} m, ${Math.round(p[1])} m`;
</script>

<DemoLayout label="Fields" bind:offen onreset={zuruecksetzen}>
	{#snippet bild()}
		<div class="bild">
			<Bildleiste items={feldModi} label="Type of field" bind:value={modus}>
				{#snippet vorschau(m)}
					<svg viewBox="0 0 100 100">
						{#if m.id === 'richtung'}
							<path class="mini" d="M15 70Q40 40 85 30M15 85Q45 60 85 50M15 50Q35 25 85 12" />
						{:else if m.id === 'abstand'}
							<path
								class="mini"
								d="M30 50a18 18 0 1 0 36 0a18 18 0 1 0 -36 0M14 50a34 30 0 1 0 68 0a34 30 0 1 0 -68 0"
							/>
						{:else}
							<path class="mini" d="M20 80v-12h12v12M44 80v-40h12v40M68 80v-20h12v20M14 80h72" />
						{/if}
					</svg>
				{/snippet}
			</Bildleiste>
			<svg
				bind:this={svg}
				class="feld"
				viewBox="-2 -14 104 116"
				role="img"
				aria-label="{info.name}: {info.text} Source at {ganz(quelle)}."
				onpointerdown={runter}
				onpointermove={bewegen}
				onpointerup={los}
				onpointercancel={los}
			>
				<rect class="rahmen" x="0" y="0" width="100" height="100" />
				{#if modus === 'richtung'}
					<path class="glyphe" d={pfeile} />
					<path class="linie" d={linien} />
				{:else if modus === 'abstand'}
					<path class="iso" d={stufen} />
					<path class="null" d={nullLinie} />
				{:else}
					{#each tuerme as t, i (i)}
						{@const p = turmPfade(t)}
						<path class="front" d={p.front} />
						<path class="dach" d={p.dach} />
					{/each}
				{/if}
				<g
					class="quelle"
					transform="translate({quelle[0]} {quelle[1]})"
					role="button"
					tabindex="0"
					aria-label="Move the source, with arrow keys or by dragging"
					onkeydown={taste}
				>
					<circle class="griff" r="7" />
					<circle class="punkt" r="2.2" />
				</g>
			</svg>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="feld" titel="Field">
			{#if modus === 'richtung'}
				<Scale live label="Swirl" bind:value={wirbel} min={0} max={100} step={5} format={prozent} />
			{:else if modus === 'abstand'}
				<Scale
					live
					label="Smoothing"
					bind:value={glaettung}
					min={0}
					max={24}
					step={1}
					format={meter}
				/>
			{:else}
				<Scale live label="Reach" bind:value={radius} min={8} max={50} step={1} format={meter} />
			{/if}
		</Steuergruppe>
		<Steuergruppe wert="saat" titel="Seed">
			<SaatZeile id="feld-saat" bind:value={saat} />
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<p><b>{info.name}.</b> {info.text} {feldHinweis}</p>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	.feld {
		display: block;
		width: 100%;
		max-width: 34rem;
		aspect-ratio: 104 / 116;
		touch-action: none;
		user-select: none;
	}
	path {
		fill: none;
		vector-effect: non-scaling-stroke;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.mini {
		stroke: var(--ink-2);
		stroke-width: 1px;
	}
	.rahmen {
		fill: none;
		stroke: var(--line);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}
	.glyphe {
		stroke: var(--ink-3);
		stroke-width: 1.5px;
	}
	.linie {
		stroke: var(--cat-business);
		stroke-width: 1.5px;
	}
	.iso {
		stroke: var(--ink-3);
		stroke-width: var(--hair);
	}
	.null {
		stroke: var(--cat-health);
		stroke-width: 2px;
	}
	.front {
		fill: var(--paper-2);
		stroke: var(--ink);
		stroke-width: 1px;
	}
	.dach {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1px;
	}
	.quelle {
		cursor: grab;
		outline: none;
	}
	.griff {
		fill: transparent;
		stroke: var(--ink);
		stroke-width: 1px;
		stroke-dasharray: 2 2;
		vector-effect: non-scaling-stroke;
	}
	.punkt {
		fill: var(--signal);
	}
	.quelle:focus-visible .griff {
		stroke-width: 2.5px;
		stroke-dasharray: none;
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
</style>
