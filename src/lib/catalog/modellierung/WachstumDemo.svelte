<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import Scale from '../ui/Scale.svelte';
	import Button from '../ui/Button.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Bildleiste from './Bildleiste.svelte';
	import Kennwert from './Kennwert.svelte';
	import { LoopUhr } from '../bibel/loopUhr.svelte';
	import {
		GROESSE,
		kennzahlen,
		referenz,
		wachstum,
		wachstumsBild
	} from '../logic/modellierung/wachstum';
	import { altstadtLizenz, altstadtWege } from '../data/altstaedte';
	import { altstadtVergleich, kennwertNamen, wachstumsregeln } from '../data/wachstum';

	/**
	 * Entry point of the Growth chapter: time-lapse of a 400 × 400 m district, beside it a
	 * real old town at the same scale. The old town stands pale beside it, never on top: overlaid,
	 * both networks would be illegible, and gray over color would read as existing stock under the new.
	 * Growth rule as an image strip above the image, time and comparison on the right. The image is a
	 * pure function of rule, seed and time; the clock is the only running state.
	 */
	const DAUER = 14,
		HALT = 3;
	const START = { regel: 'wege', saat: 1, stadt: 'siena' };

	let regel = $state(START.regel),
		saat = $state(START.saat),
		stadt = $state<string>(START.stadt),
		offen = $state('zeit');

	const uhr = new LoopUhr(true, DAUER);
	const t = $derived(Math.min(1, (uhr.sekunden % (DAUER + HALT)) / DAUER));

	const netze = $derived(
		wachstumsregeln.map((r) => ({
			regel: r,
			netz: wachstum({ familie: r.familie, saat, bindung: r.bindung })
		}))
	);
	const vorschauen = $derived(
		Object.fromEntries(netze.map((n) => [n.regel.id, wachstumsBild(n.netz, 1)]))
	);
	const aktiv = $derived(netze.find((n) => n.regel.id === regel) ?? netze[0]);
	const netzBild = $derived(wachstumsBild(aktiv.netz, t));
	const k = $derived(kennzahlen(aktiv.netz, t));
	const vergleich = $derived(altstadtWege.find((a) => a.id === stadt));
	const vergleichText = $derived(altstadtVergleich.find((a) => a.id === stadt)?.text);

	let host: HTMLDivElement;
	onMount(() => {
		const io = new IntersectionObserver(([e]) => (uhr.sichtbar = e.isIntersecting), {
			rootMargin: '100px'
		});
		io.observe(host);
		return () => {
			io.disconnect();
			uhr.stopp();
		};
	});
	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});

	/** Only real inputs pause the clock; the echo of the running value does not. */
	function setzeZeit(v: number) {
		if (Math.abs(v - t) < 0.011) return;
		uhr.laeuft = false;
		uhr.sekunden = v * DAUER;
	}
	function zuruecksetzen() {
		regel = START.regel;
		saat = START.saat;
		stadt = START.stadt;
		offen = 'zeit';
		uhr.sekunden = 0;
		uhr.laeuft = true;
	}

	const ganz = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 0 });
	const komma = (d: number) => (x: number) =>
		x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
	const prozent = (v: number) => `${Math.round(v * 100)} %`;
	const staedte = [
		...altstadtWege.map((a) => ({ value: a.id as string, label: a.name })),
		{ value: 'keine', label: 'None' }
	];
</script>

<DemoLayout label="Growth in time-lapse" bind:offen onreset={zuruecksetzen}>
	{#snippet bild()}
		<div class="bild" bind:this={host}>
			<Bildleiste items={netze.map((n) => n.regel)} label="Growth rule" bind:value={regel}>
				{#snippet vorschau(r)}
					{@const v = vorschauen[r.id]}
					<svg viewBox="0 0 {GROESSE} {GROESSE}">
						{#if v}<path class="vorschau" d={v.haupt + v.neben} />{/if}
					</svg>
				{/snippet}
			</Bildleiste>
			<div class="paar" class:allein={!vergleich}>
				<figure>
					<svg
						viewBox="-4 -4 {GROESSE + 8} {GROESSE + 8}"
						role="img"
						aria-label="{aktiv.regel.name}, seed {saat}: path network after {prozent(
							t
						)} of the growth time."
					>
						<rect class="rahmen" x="0" y="0" width={GROESSE} height={GROESSE} />
						<path class="block" d={netzBild.bloecke} />
						<path class="weg" d={netzBild.neben} />
						<path class="haupt" d={netzBild.haupt} />
						<path class="neu" d={netzBild.neu} />
					</svg>
					<figcaption>{aktiv.regel.name} · 400 m</figcaption>
				</figure>
				{#if vergleich}
					<figure>
						<svg
							viewBox="-4 -4 {GROESSE + 8} {GROESSE + 8}"
							role="img"
							aria-label="Path network of {vergleich.name}, 400 × 400 m, at the same scale."
						>
							<rect class="rahmen" x="0" y="0" width={GROESSE} height={GROESSE} />
							<path class="altstadt" d={vergleich.pfad} />
						</svg>
						<figcaption>{vergleich.name} · 400 m</figcaption>
					</figure>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="zeit" titel="Time-lapse">
			<Button
				variant="secondary"
				label={uhr.laeuft ? 'Pause' : 'Play'}
				onclick={() => {
					if (!uhr.laeuft && t >= 1) uhr.sekunden = 0;
					uhr.laeuft = !uhr.laeuft;
				}}
				aria-pressed={uhr.laeuft}
			/>
			<Scale
				live
				label="Time"
				bind:value={() => t, setzeZeit}
				min={0}
				max={1}
				step={0.01}
				format={prozent}
			/>
		</Steuergruppe>
		<Steuergruppe wert="vergleich" titel="Compare with an old town">
			<ChoiceControl id="wachstum-stadt" label="Old town" bind:value={stadt} items={staedte} />
		</Steuergruppe>
		<Steuergruppe wert="messen" titel="Measure">
			<div class="werte" aria-live="polite">
				<Kennwert
					label={kennwertNamen.a50}
					value={k.a50}
					min={0}
					max={1500}
					band={referenz.a50}
					format={ganz}
				/>
				<Kennwert
					label={kennwertNamen.cv}
					value={k.cv}
					min={0}
					max={4}
					band={referenz.cv}
					format={komma(2)}
				/>
				<Kennwert
					label={kennwertNamen.h}
					value={k.h}
					min={0}
					max={1}
					band={referenz.h}
					format={komma(2)}
				/>
				<Kennwert
					label={kennwertNamen.t}
					value={k.t}
					min={0}
					max={100}
					band={referenz.t}
					format={ganz}
				/>
			</div>
		</Steuergruppe>
		<Steuergruppe wert="saat" titel="Seed">
			<SaatZeile id="wachstum-saat" bind:value={saat} />
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<p><b>{aktiv.regel.name}.</b> {aktiv.regel.text}</p>
		{#if vergleichText}<p>{vergleichText} <span class="lizenz">{altstadtLizenz}</span></p>{/if}
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	.paar {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
	}
	.paar.allein {
		grid-template-columns: minmax(0, 1fr);
		max-width: 34rem;
	}
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	figcaption {
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	svg {
		display: block;
		width: 100%;
		aspect-ratio: 1;
	}
	path {
		fill: none;
		vector-effect: non-scaling-stroke;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.rahmen {
		fill: none;
		stroke: var(--line);
		stroke-width: var(--hair);
		vector-effect: non-scaling-stroke;
	}
	.block {
		fill: var(--paper-2);
		stroke: none;
	}
	.weg {
		stroke: var(--cat-business);
		stroke-width: 1px;
	}
	.haupt {
		stroke: var(--cat-business);
		stroke-width: 2.5px;
	}
	.neu {
		stroke: var(--ink);
		stroke-width: 1.5px;
	}
	.altstadt {
		stroke: var(--ink-3);
		stroke-width: 1px;
	}
	.vorschau {
		stroke: var(--ink-2);
		stroke-width: 1px;
	}
	.werte {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	p + p {
		margin-top: var(--space-2);
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
	.lizenz {
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	@media (max-width: 960px) {
		.paar {
			gap: var(--space-2);
		}
	}
</style>
