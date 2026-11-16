<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { LoopUhr, phaseBei } from '../bibel/loopUhr.svelte';
	import { teile } from '../logic/modellierung/split';
	import { pfad } from '../logic/modellierung/eck';
	import { teilenBeispiel as B, teilungPhasen } from '../data/wachstum';

	/**
	 * Explainer loop split tree: first cut, strips, parcels, then the dimensions flow.
	 * The access rule always applies (split only perpendicular to the frontage); one parcel is marked and stays
	 * the same across all phases. The image is a pure function of the clock time.
	 */
	const DAUER = 4.5;
	const STILL = 0.7;
	const uhr = new LoopUhr(true, STILL * DAUER);

	const stand = $derived(phaseBei(uhr.sekunden, teilungPhasen.length, DAUER));
	const fliesst = $derived(stand.index === teilungPhasen.length - 1);
	/** In the last phase t swings once back and forth; otherwise it stands in the middle. */
	const t = $derived(
		fliesst
			? B.fliessen[0] +
					(B.fliessen[1] - B.fliessen[0]) * (0.5 - 0.5 * Math.cos(2 * Math.PI * stand.anteil))
			: B.fliessen[0]
	);
	const teilung = $derived(
		teile({ saat: B.saat, tiefe: B.tiefen[stand.index], t, zugangsregel: true, front: B.front })
	);
	/** Marked parcel: the first leaf of the final stage; earlier its respective ancestor. */
	const ziel = teile({
		saat: B.saat,
		tiefe: B.tiefen[B.tiefen.length - 1],
		t: B.fliessen[0],
		zugangsregel: true,
		front: B.front
	}).blaetter[5].id;
	const markiert = $derived(teilung.blaetter.find((b) => ziel.startsWith(b.id)));

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
	function waehle(i: number) {
		uhr.sekunden = (i + (uhr.laeuft ? 0 : STILL)) * DAUER;
	}
	const name = (id: string) => 'B' + id.slice(1).split('').join('·');
</script>

<DemoLayout label="Split tree">
	{#snippet bild()}
		<div class="plan" bind:this={host}>
			<svg
				viewBox="-6 -6 92 66"
				role="img"
				aria-label="{teilungPhasen[stand.index].titel}: {teilungPhasen[stand.index].text} {teilung
					.blaetter.length} parcels."
			>
				<path class="parzelle" d={teilung.blaetter.map((b) => pfad(b.polygon)).join('')} />
				{#if markiert}<path class="markiert" d={pfad(markiert.polygon)} />{/if}
				<path class="gasse" d={pfad(teilung.block)} />
			</svg>
			{#if markiert}<p class="name">Marked: parcel {name(markiert.id)}</p>{/if}
		</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte
			id="teilung-loop"
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
	.plan {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		background: var(--paper);
	}
	svg {
		display: block;
		width: 100%;
		aspect-ratio: 92 / 66;
	}
	path {
		vector-effect: non-scaling-stroke;
		stroke-linejoin: round;
	}
	.parzelle {
		fill: var(--paper);
		stroke: var(--ink);
		stroke-width: 1px;
	}
	.markiert {
		fill: var(--paper-3);
		stroke: var(--ink);
		stroke-width: 2px;
	}
	.gasse {
		fill: none;
		stroke: var(--cat-business);
		stroke-width: 4px;
	}
	.name {
		font-size: var(--text-xs);
		color: var(--ink-2);
		font-variant-numeric: tabular-nums;
	}
</style>
