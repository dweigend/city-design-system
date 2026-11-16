<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { LoopUhr, phaseBei } from '../bibel/loopUhr.svelte';
	import Buehne from './Buehne.svelte';
	import { farbePhasen } from '../data/materialSeite';
	import { farbeSzene } from '../logic/material/formen';

	/**
	 * Explainer loop color × material: first only the material changes, then only the color,
	 * finally both together carry a building. The bodies appear one after another.
	 */
	const DAUER = 5;
	const STILL = 0.9;
	const uhr = new LoopUhr(true, STILL * DAUER);

	let host: HTMLDivElement;
	const stand = $derived(phaseBei(uhr.sekunden, farbePhasen.length, DAUER));
	const phase = $derived(farbePhasen[stand.index]);
	const stuecke = $derived(farbeSzene(phase.id, uhr.laeuft ? stand.anteil : 1));

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
</script>

<DemoLayout label="Color and material">
	{#snippet bild()}
		<div bind:this={host}>
			<Buehne
				{stuecke}
				verhaeltnis="16 / 9"
				hoeheDeg={phase.id === 'haus' ? 24 : 22}
				label="{phase.titel}: {phase.text}"
			/>
		</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte
			id="farbe-loop"
			label="Color and material"
			phasen={farbePhasen}
			index={stand.index}
			anteil={stand.anteil}
			laeuft={uhr.laeuft}
			onwahl={waehle}
			onumschalten={() => (uhr.laeuft = !uhr.laeuft)}
		/>
	{/snippet}
	{#snippet unterschrift()}
		<p>{phase.bild}</p>
	{/snippet}
</DemoLayout>
