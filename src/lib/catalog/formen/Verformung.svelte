<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import BildSatz from './BildSatz.svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import Scale from '../ui/Scale.svelte';
	import { readPalette } from '../scene/themeBinding';
	import { createCageScene } from '../scene/cage';
	import { kontrollpunkte, turm } from '../logic/modellierung/cage';
	import { ACHSEN, amRand, begrenze, startVerformung, type Achse } from '../logic/formen';
	import { verformung, verformungText } from '../data/formen';

	/**
	 * Deformation in the cage: each slider reaches exactly to the edge of its leeway
	 * (logic/formen/verformung.ts); the edge moves with the other axes.
	 * Geometry is only created on a new seed; motion is eight uniforms (scene/cage.ts).
	 */
	const ACHS_FOLGE: Achse[] = ['scherung', 'verjuengung', 'drehung'];
	/** Applied, always permitted state. */
	let lage = $state({ ...startVerformung });
	/** Edge per axis at the other current values: the end of the slider. */
	const rand = $derived(
		Object.fromEntries(
			ACHS_FOLGE.map((a) => [a, begrenze({ ...lage, [a]: ACHSEN[a].min }, a, ACHSEN[a].max)])
		) as Record<Achse, number>
	);
	const stehtAmRand = $derived(amRand(lage));
	/** Safety net: a directly set value also ends at the edge. */
	const setze = (a: Achse, ziel: number) => (lage = { ...lage, [a]: begrenze(lage, a, ziel) });
	const punkte = $derived(kontrollpunkte(lage));
	const kisten = $derived(turm(lage.saat));

	const grad = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;
	const format: Record<Achse, (v: number) => string> = {
		scherung: (v) => grad(Math.atan(v)),
		verjuengung: (v) => `${Math.round(v * 100)} %`,
		drehung: grad
	};

	let host: HTMLDivElement;
	let canvas = $state<HTMLCanvasElement>();
	let sichtbar = $state(false),
		fehler = $state('');
	let szene = $state<ReturnType<typeof createCageScene>>();
	onMount(() => {
		const io = new IntersectionObserver(([e]) => (sichtbar = e.isIntersecting), {
			rootMargin: '200px'
		});
		io.observe(host);
		return () => io.disconnect();
	});
	$effect(() => {
		const leinwand = canvas;
		if (!sichtbar || !leinwand) return;
		fehler = '';
		try {
			const s = createCageScene(leinwand, readPalette(host), () => {
				fehler = '3D view unavailable.';
			});
			szene = s;
			void s.ready.catch(() => {});
			const groesse = () => s.resize(leinwand.clientWidth, leinwand.clientHeight);
			const ro = new ResizeObserver(groesse);
			ro.observe(host);
			groesse();
			return () => {
				ro.disconnect();
				s.dispose();
				untrack(() => (szene = undefined));
			};
		} catch (cause) {
			console.error(cause);
			fehler = '3D view unavailable.';
		}
	});
	// Geometry only on a new seed; sliders change only the eight uniforms.
	$effect(() => {
		const s = szene,
			k = kisten;
		untrack(() => {
			s?.verforme(punkte);
			s?.setze(k);
		});
	});
	$effect(() => {
		szene?.verforme(punkte);
	});

	function reset() {
		lage = { ...startVerformung };
		szene?.reset();
	}
</script>

<DemoLayout label={verformung.titel} onreset={reset} resetLabel="Reset" offen="form">
	{#snippet bild()}
		<div class="bild">
			<div class="ansicht" bind:this={host}>
				<canvas
					bind:this={canvas}
					aria-label="Tower in a cage of eight points, external stair on the right. Drag to rotate, scroll wheel zooms."
					tabindex="0"
				></canvas>
				{#if fehler}<p role="status">{fehler}</p>{/if}
			</div>
			<BildSatz text={stehtAmRand ? verformungText.rand : verformungText.frei} />
		</div>
	{/snippet}
	{#snippet steuerung()}
		<Steuergruppe wert="form" titel="Deform the cage">
			{#each ACHS_FOLGE as a (a)}
				<Scale
					live
					label={verformungText.regler[a]}
					bind:value={() => lage[a], (v) => setze(a, v)}
					min={ACHSEN[a].min}
					max={Math.max(ACHSEN[a].min + ACHSEN[a].step, rand[a])}
					step={ACHSEN[a].step}
					format={format[a]}
				/>
			{/each}
		</Steuergruppe>
		<Steuergruppe wert="fein" titel="Fine settings">
			<SaatZeile
				bind:value={() => lage.saat, (v) => (lage = { ...lage, saat: v })}
				id="verformung-saat"
			/>
		</Steuergruppe>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.ansicht {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 10;
		border: var(--hair) solid var(--line);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	canvas:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	p[role='status'] {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
