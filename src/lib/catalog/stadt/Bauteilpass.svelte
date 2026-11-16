<script lang="ts">
	import { onDestroy } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import StadtBuehne from './StadtBuehne.svelte';
	import LoopSteuerung from './LoopSteuerung.svelte';
	import PassKarte from './PassKarte.svelte';
	import { LoopUhr } from '../bibel/loopUhr.svelte';
	import { bauteilLoops, type BauteilLoopId, type LoopPhase } from '../data/stadtBausteine';
	import { bauteilRahmen, bauteilSzene } from '../logic/stadt/bauteile';
	import { loopSchleier, phaseAt, phaseStart } from '../logic/stadt/zeitleiste';

	/**
	 * Component passport: one instance and its lifecycle record. Three loops show what the passport records
	 * while the piece moves, is split or is newly connected. The passport hangs in the image, a
	 * line leads to the instance wherever it currently is. A click on the instance restarts the loop.
	 */
	let loopWert = $state<string>('fenster');
	let hover = $state<string>();
	let passBreite = $state(0);
	const loop = $derived(bauteilLoops.find((l) => l.value === loopWert) ?? bauteilLoops[0]);
	// Without motion: still image shortly before the end, with the full lifecycle record.
	const STANDBILD = (phasen: readonly LoopPhase[]) =>
		phaseStart(phasen, phasen.length - 1) + phasen[phasen.length - 1].durationS * 0.95;
	const uhr = new LoopUhr(true, STANDBILD(bauteilLoops[0].phasen));
	$effect(() => {
		void uhr.laeuft;
		void uhr.sichtbar;
		uhr.abgleichen();
	});
	onDestroy(() => uhr.stopp());

	const lage = $derived(phaseAt(loop.phasen, uhr.sekunden));
	const szene = $derived(bauteilSzene(loop.value as BauteilLoopId, lage.timeS, hover));
	const klick = $derived(lage.index === 0 && lage.local < 0.3);
	const passDa = $derived(lage.index > 0 || lage.local >= 0.3);
	// At the end of the loop the image fades briefly into the paper and returns at the start: no hard jump.
	const schleier = $derived(uhr.laeuft ? loopSchleier(loop.phasen, uhr.sekunden) : 0);

	let vorher = 'fenster';
	$effect(() => {
		if (loopWert !== vorher) {
			vorher = loopWert;
			uhr.set(uhr.laeuft ? 0 : STANDBILD(loop.phasen));
		}
	});

	function springe(i: number) {
		uhr.set(phaseStart(loop.phasen, i) + (uhr.laeuft ? 0 : loop.phasen[i].durationS * 0.9));
	}
</script>

<DemoLayout label="Component passport">
	{#snippet bild()}
		<StadtBuehne
			kisten={szene.kisten}
			rahmen={bauteilRahmen[loop.value]}
			bind:hover
			bind:visible={uhr.sichtbar}
			{schleier}
			onpick={(t) => {
				if (t === 'exemplar') uhr.set(0);
			}}
			label="A component with a passport: {loop.label}. The passport shows the provenance and lifecycle record of this one instance."
		>
			{#snippet overlay(project)}
				{@const q = project(szene.exemplar)}
				<div class="ebene">
					{#if passDa}
						<svg class="faden" aria-hidden="true">
							<line x1={passBreite + 12} y1="34" x2={q.x} y2={q.y} />
							<circle cx={q.x} cy={q.y} r="3" />
						</svg>
						<div class="karte">
							<PassKarte
								pass={loop.pass}
								phase={lage.index}
								local={lage.local}
								bind:breite={passBreite}
							/>
						</div>
					{/if}
					{#if klick}<span class="klick" style:left="{q.x}px" style:top="{q.y}px"></span>{/if}
				</div>
			{/snippet}
		</StadtBuehne>
	{/snippet}

	{#snippet steuerung()}
		<ChoiceControl id="pass-loop" label="Component" items={bauteilLoops} bind:value={loopWert} />
		<LoopSteuerung
			id="pass-ablauf"
			label="Sequence"
			phasen={loop.phasen}
			index={lage.index}
			local={lage.local}
			running={uhr.laeuft}
			onselect={springe}
			ontoggle={() => uhr.toggle()}
		/>
	{/snippet}

	{#snippet unterschrift()}
		<p>
			The passport belongs to the instance, not to the type. It goes wherever the piece goes, and
			grows longer, never new.
		</p>
	{/snippet}
</DemoLayout>

<style>
	.ebene {
		position: absolute;
		inset: 0;
		container: stadtbild / inline-size;
	}
	.karte {
		position: absolute;
		left: var(--space-3);
		top: var(--space-3);
	}
	.faden {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.faden line {
		stroke: var(--ink);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.faden circle {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1.5;
	}
	.klick {
		position: absolute;
		width: var(--space-10);
		height: var(--space-10);
		margin: calc(-1 * var(--space-5)) 0 0 calc(-1 * var(--space-5));
		border: var(--stroke) solid var(--signal);
		border-radius: 50%;
		animation: klick 700ms var(--ease) infinite;
	}
	@keyframes klick {
		from {
			transform: scale(0.3);
			opacity: 1;
		}
		to {
			transform: scale(1);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.klick {
			animation: none;
		}
	}
</style>
