<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import WinkelSpanne from './WinkelSpanne.svelte';
	import { LoopUhr, phaseBei, reduzierteBewegung } from '../bibel/loopUhr.svelte';
	import {
		anGrenze,
		bogenRadius,
		gradText,
		spielraumBild,
		winkelAnker,
		type SpielraumSzene
	} from './spielraumBild';
	import * as L from './spielraumLauf';
	import { createRasterBuehne, type RasterBuehne } from '../scene/rasterBuehne';
	import { ablauf, messe, punkt } from '../logic/bibel/spielraum';
	import type { UniversalPatch } from '../logic/parametrik/raster/universal';
	import type { Point2 } from '../logic/parametrik/vocab';
	import { spielraumPhasen, ziehHinweis } from '../data/raster';

	/**
	 * Explainer loop “The mesh moves, the rules stay”. The choreography is a pure
	 * function of time (`ablauf`): the mesh warps out of the straight ghost, the buildings move along
	 * (roofs with a slight lag), then the leeway of one corner unfolds and the corner runs to
	 * its edge. Angle arcs sit on the image, the protractor on the right shows the rule.
	 *
	 * Dragging: grabbing pauses the loop and takes over the visible state; the pointer is smoothed,
	 * a leash shows where the corner wanted to go. Play glides back into the loop. Touch grabs
	 * generously and lets the page scroll outside the corners. Reduced motion: no autoplay, no
	 * smoothing, no lag, no ripple. This file only wires things up; the run lives in
	 * `spielraumLauf`, the image in `spielraumBild`.
	 */
	const ruhe = reduzierteBewegung();
	const uhr = new LoopUhr(true, L.STILL * L.DAUER);
	const sanft = (x: number) => {
		const k = Math.max(0, Math.min(1, x));
		return k * k * (3 - 2 * k);
	};
	type Szene = Omit<SpielraumSzene, 'winkel' | 'dach' | 'hover'>;

	let hand = $state.raw<L.Hand>();
	let rueck = $state.raw<{ von: UniversalPatch; k: number }>();
	let jetzt = $state(0);
	let dach = $state.raw<ReadonlyMap<string, Point2>>();
	let hover = $state<string>();
	let greift = $state(false);
	let versatz: Point2 = [0, 0];

	const stand = $derived(phaseBei(uhr.sekunden, spielraumPhasen.length, L.DAUER));
	const zug = $derived(ablauf(stand.index, stand.anteil));
	const loop = $derived(L.loopLage(zug));

	const szene = $derived.by((): Szene => {
		if (hand) {
			const h = hand;
			return {
				patch: L.handLage(h),
				frei: L.T.frei,
				ecke: h.id,
				nachbarn: 0,
				raum: {
					polygon: h.raum,
					mitte: h.mitte,
					staerke: ruhe ? 1 : sanft((jetzt - h.seit) / L.ZEIT.entfalten)
				},
				amRand: h.amRand,
				wunsch: h.glatt,
				welle: ruhe ? undefined : (jetzt - h.anschlag) / L.ZEIT.welle
			};
		}
		return {
			patch: rueck ? L.mische(rueck.von, loop.patch, sanft(rueck.k)) : loop.patch,
			frei: L.T.frei,
			ecke: L.START_ECKE,
			geist: { patch: L.GERADE, staerke: zug.geist },
			nachbarn: zug.nachbarn,
			// While gliding back, the zone of the target state does not apply yet: zone, leash and ripple wait.
			raum:
				zug.raum > 0 && !rueck
					? { polygon: L.RAUM_START, mitte: L.P0, staerke: zug.raum }
					: undefined,
			amRand: loop.amRand && !rueck,
			wunsch: rueck ? undefined : loop.wunsch,
			welle:
				stand.index === 2 && !ruhe && !rueck
					? ((stand.anteil - L.A_ANSCHLAG) * L.DAUER) / L.ZEIT.welle
					: undefined
		};
	});

	const mass = $derived(messe(szene.patch, szene.ecke));
	/** Sharpest and widest angle; if both are equal (straight mesh), only one. */
	const stellen = $derived(
		mass.weit.grad - mass.spitz.grad < 0.5 ? [mass.spitz] : [mass.spitz, mass.weit]
	);
	const bild = $derived(
		spielraumBild({
			...szene,
			dach: ruhe ? undefined : dach,
			hover: hover !== szene.ecke ? hover : undefined,
			winkel: { stellen, staerke: hand || rueck ? 1 : 0.5 + 0.5 * zug.raum }
		})
	);

	let canvas: HTMLCanvasElement;
	let host: HTMLDivElement;
	let buehne = $state<RasterBuehne>();
	let groesse = $state(0);
	let fehler = $state('');

	/** Labels of the angle arcs, anchored to the image. */
	const marken = $derived.by(() => {
		const b = buehne;
		if (!b || !groesse) return [];
		const m = stellen.map((s) => {
			const q = b.projiziere(winkelAnker(s, bogenRadius(s) + 1.9), 0.1);
			return { x: q.x, y: q.y, grad: gradText(s.grad), grenze: anGrenze(s) };
		});
		return L.auseinander(m, 50, 18);
	});

	// One driver for everything that moves per frame: clock, smoothing, lag, gliding back.
	let frame = 0,
		zuletzt = 0;
	function antreiben() {
		if (frame || !uhr.sichtbar) return;
		zuletzt = 0;
		frame = requestAnimationFrame(tick);
	}
	function tick(now: number) {
		frame = 0;
		const dt = zuletzt ? Math.min((now - zuletzt) / 1000, 0.1) : 0;
		zuletzt = now;
		jetzt = now / 1000;
		let weiter = !hand && uhr.laeuft;
		if (weiter) uhr.sekunden += dt;
		if (rueck) {
			const k = rueck.k + dt / L.ZEIT.zurueck;
			rueck = k >= 1 ? undefined : { ...rueck, k };
			weiter = true;
		}
		if (hand) {
			const r = L.fuehre(hand, dt, ruhe, jetzt);
			hand = r.hand;
			weiter ||= greift || r.rest > 1e-3 || L.bewegtSich(hand, jetzt);
		}
		if (!ruhe) {
			const n = L.nachlauf(dach, szene.patch, dt);
			dach = n.dach;
			weiter ||= n.rest > 2e-3;
		}
		if (weiter && uhr.sichtbar) frame = requestAnimationFrame(tick);
	}

	/** Free corner near an image point (CSS pixels) within the grab radius. */
	function greifbar(x: number, y: number, art: string): string | undefined {
		const b = buehne;
		if (!b) return undefined;
		return L.greifbar(szene.patch, (p) => b.projiziere(p, 0.1), x, y, art);
	}
	function relativ(e: { clientX: number; clientY: number }) {
		const r = canvas.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}
	function amBoden(e: PointerEvent): Point2 {
		const { x, y } = relativ(e);
		return buehne ? buehne.zumBoden(x, y) : [0, 0];
	}
	function greife(id: string) {
		hand = L.greife(szene.patch, id, hand, performance.now() / 1000);
		rueck = undefined;
		uhr.laeuft = false;
		antreiben();
	}

	function runter(e: PointerEvent) {
		const { x, y } = relativ(e);
		const id = greifbar(x, y, e.pointerType);
		if (!id) return;
		greife(id);
		// The corner does not jump under the finger, it keeps its distance to the pointer.
		const b = amBoden(e),
			p = punkt(szene.patch, id);
		versatz = [p[0] - b[0], p[1] - b[1]];
		greift = true;
		hover = undefined;
		canvas.setPointerCapture(e.pointerId);
		e.preventDefault();
	}
	function bewege(e: PointerEvent) {
		if (greift && hand) {
			const b = amBoden(e);
			hand = { ...hand, ziel: [b[0] + versatz[0], b[1] + versatz[1]] };
			antreiben();
		} else if (e.pointerType === 'mouse') {
			const { x, y } = relativ(e);
			hover = greifbar(x, y, 'mouse');
		}
	}
	function los(e: PointerEvent) {
		if (!greift) return;
		greift = false;
		if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
		// The corner stays at the last permitted position; the leash disappears.
		if (hand) hand = { ...hand, ziel: hand.punkt, glatt: hand.punkt, amRand: false };
		antreiben();
	}
	function taste(e: KeyboardEvent) {
		const d = L.PFEILE[e.key];
		if (!d) return;
		e.preventDefault();
		if (!hand) greife(szene.ecke);
		if (!hand) return;
		// From the permitted state: pressing against the edge does not accumulate any excess.
		const p = hand.punkt;
		hand = { ...hand, ziel: [p[0] + d[0], p[1] + d[1]] };
		antreiben();
	}
	/** Back into the loop, smoothly from the visible state. */
	function zurueck() {
		if (!hand) return;
		rueck = ruhe ? undefined : { von: szene.patch, k: 0 };
		hand = undefined;
	}
	function umschalten() {
		if (hand) {
			zurueck();
			uhr.laeuft = true;
		} else uhr.laeuft = !uhr.laeuft;
		antreiben();
	}
	function waehle(i: number) {
		zurueck();
		uhr.sekunden = (i + (uhr.laeuft ? 0 : L.STILL)) * L.DAUER;
		antreiben();
	}

	onMount(() => {
		// Decide autoplay only after mount, while the stage is still invisible.
		// After that only our shared tick drives clock and dragging.
		uhr.abgleichen();
		const io = new IntersectionObserver(
			([e]) => {
				uhr.sichtbar = e.isIntersecting;
				antreiben();
			},
			{ rootMargin: '100px' }
		);
		io.observe(host);
		let aktuell: RasterBuehne | undefined;
		try {
			aktuell = createRasterBuehne(
				canvas,
				{ extent: 23, hoeheDeg: 62, azimutDeg: 14 },
				{ onError: () => (fehler = '3D view unavailable.') }
			);
			void aktuell.ready.catch(() => {});
			buehne = aktuell;
		} catch (cause) {
			console.error(cause);
			fehler = '3D view unavailable.';
		}
		const ro = new ResizeObserver(() => {
			aktuell?.resize(canvas.clientWidth, canvas.clientHeight);
			groesse = canvas.clientWidth * 10000 + canvas.clientHeight;
		});
		ro.observe(canvas);
		// Touch: prevent scrolling only on a corner, otherwise the page keeps scrolling.
		const beruehrt = (e: TouchEvent) => {
			const p = e.touches[0];
			if (e.touches.length !== 1 || !p) return;
			const { x, y } = relativ(p);
			if (greifbar(x, y, 'touch')) e.preventDefault();
		};
		const leinwand = canvas;
		leinwand.addEventListener('touchstart', beruehrt, { passive: false });
		return () => {
			io.disconnect();
			ro.disconnect();
			leinwand.removeEventListener('touchstart', beruehrt);
			if (frame) cancelAnimationFrame(frame);
			frame = 0;
			uhr.stopp();
			aktuell?.dispose();
			buehne = undefined;
		};
	});

	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		antreiben();
	});
	$effect(() => {
		buehne?.zeige(bild);
	});
</script>

<DemoLayout label="Corner leeway">
	{#snippet bild()}
		<div class="stage" bind:this={host}>
			<canvas
				bind:this={canvas}
				tabindex="0"
				data-greifbar={hover ? '' : undefined}
				data-greift={greift ? '' : undefined}
				aria-label="Quad mesh with buildings. {ziehHinweis} Arrow keys move the selected corner."
				onpointerdown={runter}
				onpointermove={bewege}
				onpointerup={los}
				onpointercancel={los}
				onpointerleave={() => (hover = undefined)}
				onkeydown={taste}
			></canvas>
			{#each marken as m, i (i)}
				<span
					class="marke"
					class:grenze={m.grenze}
					aria-hidden="true"
					style:left="{m.x}px"
					style:top="{m.y}px">{m.grad}</span
				>
			{/each}
			{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
		</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte
			id="spielraum-loop"
			label="Deformation"
			phasen={spielraumPhasen}
			index={hand ? 2 : stand.index}
			anteil={hand ? 1 : stand.anteil}
			laeuft={uhr.laeuft && !hand}
			onwahl={waehle}
			onumschalten={umschalten}
		/>
		<WinkelSpanne kleinster={mass.kleinster} groesster={mass.groesster} seiten={mass.seiten} />
	{/snippet}
	{#snippet unterschrift()}
		<p>{ziehHinweis}</p>
	{/snippet}
</DemoLayout>

<style>
	.stage {
		position: relative;
		overflow: hidden;
		border: var(--hair) solid var(--line);
		background: var(--paper);
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		touch-action: pan-y pinch-zoom;
	}
	canvas[data-greifbar] {
		cursor: grab;
	}
	canvas[data-greift] {
		cursor: grabbing;
	}
	canvas:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: -2px;
	}
	.marke {
		position: absolute;
		transform: translate(-50%, -50%);
		padding: 1px 5px;
		border-radius: 2px;
		background: color-mix(in oklch, var(--paper) 88%, transparent);
		color: var(--ink);
		font-size: 11px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1.3;
		pointer-events: none;
		white-space: nowrap;
	}
	.marke.grenze {
		color: var(--signal);
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
