<script lang="ts">
	import { onMount } from 'svelte';
	import { Toggle } from 'bits-ui';
	import { SvelteSet } from 'svelte/reactivity';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import Scale from '../ui/Scale.svelte';
	import Switch from '../ui/Switch.svelte';
	import { erreichbar, standardTore, wfc } from '../logic/modellierung/wfc';

	/**
	 * Wave Function Collapse on footbridge tiles: numbers show how many tiles still fit in a cell;
	 * a click places or removes a building. The check fades out footbridge pieces without a path to
	 * a gate instead of denouncing them: they do not belong to the network. Narrow, the field has
	 * 7 columns so that every cell measures at least 44 px.
	 */
	const id = $props.id();
	const ZELLEN = { breit: [10, 7], schmal: [7, 8] } as const;
	/** Buildings as a share of width and height, so both formats show the same image. */
	const START_HAEUSER: [number, number][] = [
		[0.35, 0.3],
		[0.45, 0.3],
		[0.65, 0.65]
	];
	let schmal = $state(false),
		saat = $state(1),
		pruefen = $state(true),
		offen = $state('lauf');
	const [breite, hoehe] = $derived(schmal ? ZELLEN.schmal : ZELLEN.breit);
	const haeuser = new SvelteSet<number>();
	function startHaeuser() {
		haeuser.clear();
		for (const [u, v] of START_HAEUSER)
			haeuser.add(Math.floor(v * hoehe) * breite + Math.floor(u * breite));
	}
	startHaeuser();
	// Format change (wide ↔ narrow): put buildings in the same relative places.
	let format = '';
	$effect.pre(() => {
		const neu = `${breite}x${hoehe}`;
		if (format && format !== neu) startHaeuser();
		format = neu;
	});

	const tore = $derived(standardTore(breite, hoehe));
	const ergebnis = $derived(wfc({ breite, hoehe, saat, haeuser: [...haeuser], tore }));
	let schritt = $derived(ergebnis.schritte.length);
	const aktuell = $derived(ergebnis.schritte[schritt - 1]);
	const optionen = $derived(aktuell?.optionen ?? ergebnis.start);
	const erreicht = $derived(erreichbar(ergebnis, tore));
	const ende = $derived(schritt === ergebnis.schritte.length);
	const ausgabe = $derived(
		ergebnis.status === 'widerspruch'
			? 'No tile fits here anymore. Remove a building.'
			: !ende
				? 'Every placed tile strikes from its neighbors what no longer fits. The numbers show how much choice remains.'
				: pruefen
					? 'All edges fit. Pale are footbridge pieces without a path to a gate: the check finds them, they are not built.'
					: 'All edges fit. Whether every footbridge reaches a gate, the method does not know.'
	);
	const richtungen = [
		[1, 0.5, 0],
		[2, 1, 0.5],
		[4, 0.5, 1],
		[8, 0, 0.5]
	];
	const torPfad = $derived(
		`M-0.3 ${Math.floor(hoehe / 2) + 0.3} L-0.06 ${Math.floor(hoehe / 2) + 0.5} L-0.3 ${Math.floor(hoehe / 2) + 0.7} Z ` +
			`M${breite + 0.3} ${Math.floor(hoehe / 2) + 0.3} L${breite + 0.06} ${Math.floor(hoehe / 2) + 0.5} L${breite + 0.3} ${Math.floor(hoehe / 2) + 0.7} Z`
	);

	onMount(() => {
		const mq = matchMedia('(max-width: 600px)');
		schmal = mq.matches;
		const wechsel = () => (schmal = mq.matches);
		mq.addEventListener('change', wechsel);
		return () => mq.removeEventListener('change', wechsel);
	});
	function zuruecksetzen() {
		saat = 1;
		pruefen = true;
		offen = 'lauf';
		startHaeuser();
	}
</script>

<DemoLayout label="Wave Function Collapse" bind:offen onreset={zuruecksetzen}>
	{#snippet bild()}
		<div class="plan" style:--b={breite + 0.8} style:--h={hoehe + 0.8}>
			<svg
				viewBox="-0.4 -0.4 {breite + 0.8} {hoehe + 0.8}"
				role="img"
				aria-label="Footbridge tiles that fit their neighbors on every edge. {ausgabe}"
			>
				{#each ergebnis.kacheln as kachel, i (i)}
					<g transform="translate({i % breite} {Math.floor(i / breite)})">
						<rect class="raster" width="1" height="1" />
						{#if haeuser.has(i)}
							<rect class="haus" x="0.18" y="0.18" width="0.64" height="0.64" />
						{:else if optionen[i] === 1 && kachel >= 0}
							{#each richtungen as [bit, x, y] (bit)}
								{#if kachel & bit}
									<path
										class="steg"
										class:aussen={pruefen && ende && !erreicht.has(i)}
										d="M0.5 0.5 L{x} {y}"
									/>
								{/if}
							{/each}
						{:else}
							<text x="0.5" y="0.5">{optionen[i]}</text>
						{/if}
						{#if aktuell?.zelle === i && !ende}<rect
								class="aktuell"
								x="0.04"
								y="0.04"
								width="0.92"
								height="0.92"
							/>{/if}
					</g>
				{/each}
				<path class="tor" d={torPfad} />
			</svg>
			{#each ergebnis.kacheln.keys() as i (`${breite}-${i}`)}
				<Toggle.Root
					class="zelle"
					pressed={haeuser.has(i)}
					aria-label="Cell {(i % breite) + 1}, {Math.floor(i / breite) + 1}: building"
					style="left: {(((i % breite) + 0.4) / (breite + 0.8)) * 100}%; top: {((Math.floor(
						i / breite
					) +
						0.4) /
						(hoehe + 0.8)) *
						100}%"
					onPressedChange={(an) => {
						if (an) haeuser.add(i);
						else haeuser.delete(i);
					}}
				/>
			{/each}
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="lauf" titel="Sequence">
			{#if ergebnis.schritte.length > 0}
				<Scale
					live
					label="Step"
					bind:value={schritt}
					min={0}
					max={ergebnis.schritte.length}
					step={1}
				/>
			{/if}
			<Switch id="{id}-pruefen" label="Check reachability" bind:checked={pruefen} />
		</Steuergruppe>
		<Steuergruppe wert="saat" titel="Seed">
			<SaatZeile id="{id}-saat" bind:value={saat} />
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<p aria-live="polite">{ausgabe} A click on a cell places a building.</p>
	{/snippet}
</DemoLayout>

<style>
	.plan {
		position: relative;
		width: 100%;
		max-width: 40rem;
		aspect-ratio: var(--b) / var(--h);
	}
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	.raster {
		fill: none;
		stroke: var(--line);
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
	.haus {
		fill: var(--paper-3);
		stroke: var(--ink);
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
	.steg {
		fill: none;
		stroke: var(--cat-business);
		stroke-width: 0.28;
		stroke-linecap: round;
		transition: opacity var(--fast) var(--ease);
	}
	.steg.aussen {
		opacity: 0.18;
	}
	.aktuell {
		fill: none;
		stroke: var(--ink);
		stroke-width: 1px;
		vector-effect: non-scaling-stroke;
	}
	.tor {
		fill: var(--ink);
	}
	text {
		fill: var(--ink-3);
		font-family: var(--font-mono);
		font-size: 0.23px;
		text-anchor: middle;
		dominant-baseline: central;
	}
	.plan :global(.zelle) {
		position: absolute;
		width: calc(100% / var(--b));
		height: calc(100% / var(--h));
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		touch-action: manipulation;
	}
	.plan :global(.zelle:hover) {
		box-shadow: inset 0 0 0 1px var(--ink-3);
	}
	.plan :global(.zelle:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	@media (prefers-reduced-motion: reduce) {
		.steg {
			transition: none;
		}
	}
</style>
