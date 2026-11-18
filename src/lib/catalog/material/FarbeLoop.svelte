<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { studienLoop } from './studienLoop.svelte';
	import Buehne from './Buehne.svelte';
	import { farbePhasen } from '../data/materialSeite';
	import { farbeSzene } from '../logic/material/formen';

	/**
	 * Explainer loop color × material: first only the material changes, then only the color,
	 * finally both together carry a building. The bodies appear one after another.
	 */

	let host: HTMLDivElement;
	const loop = studienLoop(() => host, farbePhasen.length, 5, 0.9);
	const uhr = loop.uhr;
	const stand = $derived(loop.stand);
	const phase = $derived(farbePhasen[stand.index]);
	const stuecke = $derived(farbeSzene(phase.id, uhr.laeuft ? stand.anteil : 1));
</script>

<DemoLayout label="Color and material">
	{#snippet bild()}
		<div bind:this={host}>
			<Buehne
				{stuecke}
				studio
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
			{...loop.schritte}
		/>
	{/snippet}
	{#snippet unterschrift()}
		<p>{phase.bild}</p>
	{/snippet}
</DemoLayout>
