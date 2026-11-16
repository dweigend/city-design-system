<script lang="ts">
	import { onMount } from 'svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Vertiefung from '../ui/Vertiefung.svelte';
	import LoopSchritte from '../bibel/LoopSchritte.svelte';
	import { LoopUhr, phaseBei } from '../bibel/loopUhr.svelte';
	import Buehne from './Buehne.svelte';
	import KnotenKette from './KnotenKette.svelte';
	import {
		familie,
		rezeptFamilien,
		rezeptPhasen,
		rezeptVertiefung,
		type FamilieId
	} from '../data/materialSeite';
	import { rezeptSzene } from '../logic/material/formen';
	import { rezept, voreinstellung } from '../logic/material/rezept';
	import { tslQuelle } from '../logic/material/tslQuelle';

	/**
	 * Explainer loop “Kit”: a material arises node by node. Box and dome show
	 * flat and round surfaces; the node chain and the TSL line stand directly below.
	 * The image is a pure function of the clock time and the family.
	 */
	const DAUER = 3.4;
	const STILL = 0.5;
	const uhr = new LoopUhr(true, STILL * DAUER);

	let fam = $state<string>('beton');
	let host: HTMLDivElement;

	const eintrag = $derived(rezeptFamilien.find((x) => x.id === fam) ?? rezeptFamilien[0]);
	const f = $derived(familie(fam as FamilieId));
	const stand = $derived(phaseBei(uhr.sekunden, rezeptPhasen.length, DAUER));
	const phase = $derived(rezeptPhasen[stand.index]);
	const stuecke = $derived(rezeptSzene(eintrag.id, eintrag.strom, stand.index + 1));
	const quelle = $derived(tslQuelle(rezept(eintrag.id, voreinstellung(eintrag.id, eintrag.strom))));
	const satz = $derived(
		phase.id === 'rauschen' || phase.id === 'fugen' || phase.id === 'haut' ? f.knoten[phase.id] : ''
	);
	const familien = rezeptFamilien.map((x) => ({ value: x.id, label: familie(x.id).name }));

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

<DemoLayout label="Kit of a material">
	{#snippet bild()}
		<div class="bild" bind:this={host}>
			<Buehne
				{stuecke}
				verhaeltnis="16 / 8"
				label="{f.name} after step {stand.index + 1}, {phase.titel}: {phase.text}"
			/>
			<KnotenKette phasen={rezeptPhasen} index={stand.index} code={quelle[stand.index].code} />
		</div>
	{/snippet}
	{#snippet steuerung()}
		<ChoiceControl id="rezept-familie" label="Material" bind:value={fam} items={familien} />
		<LoopSchritte
			id="rezept-loop"
			label="Nodes"
			phasen={rezeptPhasen}
			index={stand.index}
			anteil={stand.anteil}
			laeuft={uhr.laeuft}
			onwahl={waehle}
			onumschalten={() => (uhr.laeuft = !uhr.laeuft)}
		/>
	{/snippet}
	{#snippet unterschrift()}
		{#if satz}<p><b>{f.name}.</b> {satz}</p>{/if}
		<Vertiefung label="The whole recipe in TSL">
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
		color: var(--ink-3);
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
