<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Vertiefung from '../ui/Vertiefung.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { studienLoop } from './studienLoop.svelte';
	import Buehne from './Buehne.svelte';
	import KnotenKette from './KnotenKette.svelte';
	import { familie, rezeptPhasen, rezeptVertiefung } from '../data/materialSeite';
	import { knotenSzene } from '../logic/material/formen';
	import type { Rezept } from '../logic/material/rezept';
	import { tslQuelle } from '../logic/material/tslQuelle';

	/**
	 * Explainer loop “Kit”: a material arises node by node. Box and dome show
	 * flat and round surfaces; the node chain and the TSL line stand directly below.
	 * The image is a pure function of the clock time and the recipe, which follows the picker's
	 * material and color read-only.
	 */

	let { rezept, finish }: { rezept: Rezept; finish: string } = $props();
	let host: HTMLDivElement;

	const r = $derived(rezept);
	const f = $derived(familie(r.familie));
	const loop = studienLoop(() => host, rezeptPhasen.length, 3.4, 0.5);
	const uhr = loop.uhr;
	const stand = $derived(loop.stand);
	const phase = $derived(rezeptPhasen[stand.index]);
	const anzahl = $derived(stand.index + 1);
	const stuecke = $derived(knotenSzene(r, anzahl));
	const quelle = $derived(tslQuelle(r));
	const satz = $derived(
		phase.id === 'rauschen' || phase.id === 'fugen' || phase.id === 'haut' ? f.knoten[phase.id] : ''
	);
</script>

<DemoLayout label="Simplified diagram recipe">
	{#snippet bild()}
		<div class="bild" bind:this={host}>
			<Buehne
				{stuecke}
				diagrammZeitS={r.haut.bewegt && anzahl >= 3 ? uhr.sekunden : 0}
				bewegung={false}
				verhaeltnis="16 / 8"
				label="Simplified diagram representation: {f.name} after step {stand.index +
					1}, {phase.titel}: {phase.text}"
			/>
			<KnotenKette phasen={rezeptPhasen} index={stand.index} code={quelle[stand.index].code} />
		</div>
	{/snippet}
	{#snippet steuerung()}
		<LoopSchritte id="rezept-loop" label="Nodes" phasen={rezeptPhasen} {...loop.schritte} />
	{/snippet}
	{#snippet unterschrift()}
		{#if satz}<p><b>{f.name}.</b> {satz}</p>{/if}
		<p>
			Six nodes build {f.name.toLowerCase()} as a diagram. The picker above shows {finish} in the studio.
		</p>
		<Vertiefung label="The diagram recipe in TSL">
			<pre><code
					>{#each quelle as z, i (z.knoten)}<span class="zeile" class:jetzt={i === stand.index}
							>{z.code}</span
						>{/each}</code
				></pre>
			<p class="klein">{rezeptVertiefung}</p>
		</Vertiefung>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	p + :global(.vertiefung) {
		margin-top: var(--space-3);
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
	pre {
		margin: 0 0 var(--space-3);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: 1.6;
		color: var(--ink-2);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.zeile {
		display: block;
	}
	.jetzt {
		color: var(--ink);
		font-weight: 600;
	}
	.klein {
		font-size: var(--text-xs);
	}
</style>
