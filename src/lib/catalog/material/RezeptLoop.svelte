<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Vertiefung from '../ui/Vertiefung.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { studienLoop } from './studienLoop.svelte';
	import Buehne from './Buehne.svelte';
	import KnotenKette from './KnotenKette.svelte';
	import {
		achsenWahl,
		familie,
		familien,
		rezeptPhasen,
		rezeptVertiefung
	} from '../data/materialSeite';
	import { knotenSzene } from '../logic/material/formen';
	import type { MaterialWerkstatt, MaterialWahl } from '../logic/material/werkstatt';
	import { tslQuelle } from '../logic/material/tslQuelle';

	/**
	 * Explainer loop “Kit”: a material arises node by node. Box and dome show
	 * flat and round surfaces; the node chain and the TSL line stand directly below.
	 * The image is a pure function of the clock time and the family.
	 */

	let { werkstatt, waehle }: { werkstatt: MaterialWerkstatt; waehle: MaterialWahl } = $props();
	let host: HTMLDivElement;

	const r = $derived(werkstatt.rezept);
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
	const materialWahl = familien.map((x) => ({ value: x.id, label: x.name }));
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
		<ChoiceControl
			id="rezept-familie"
			label="Material"
			bind:value={() => f.id, (v) => waehle('beispiel', v)}
			items={materialWahl}
		/>
		<ChoiceControl
			id="rezept-deckkraft"
			label="Diagram opacity"
			bind:value={() => werkstatt.auswahl.wahl.deckkraft, (v) => waehle('deckkraft', v)}
			items={[...achsenWahl.deckkraft]}
		/>
		<LoopSchritte id="rezept-loop" label="Nodes" phasen={rezeptPhasen} {...loop.schritte} />
	{/snippet}
	{#snippet unterschrift()}
		{#if satz}<p><b>{f.name}.</b> {satz}</p>{/if}
		<p>
			The six stages show the recipe for {werkstatt.auswahl.finish.name}. The studio lights its
			physical finish.
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
