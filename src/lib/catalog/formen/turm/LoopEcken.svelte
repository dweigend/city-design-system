<script lang="ts">
	import { untrack } from 'svelte';
	import Buehne from './Buehne.svelte';
	import FormLoop from '../FormLoop.svelte';
	import MaskenSchema from './MaskenSchema.svelte';
	import { maskName } from '../../logic/parametrik/formen/eck';
	import { slotView } from '../../logic/parametrik/formen/eckvorschau';
	import { funktion } from '../../logic/parametrik/eckraster/funktion';
	import {
		eckAusId,
		eckBild,
		eckDauern,
		eckeUmschalten,
		eckSchritte,
		takt
	} from '../../logic/formen';
	import { eckLoop } from '../../data/turm';

	/**
	 * Loop “The corners choose the module”: corners fill up, the module grows into the quad.
	 * A click on a corner (in the image or in the diagram) pauses and toggles it.
	 * Geometry from logic/parametrik/formen/eck.ts (eckModul), not reinvented.
	 */
	let t = $state(0),
		spielt = $state(true);
	/** Own mask as soon as you toggle a corner; null = the loop leads. */
	let eigen = $state<number | null>(null);
	const index = $derived(takt(eckDauern, t).index);
	const schritt = $derived(eckSchritte[index]);
	const maske = $derived(eigen ?? schritt.mask);
	const token = funktion('wohnen').token ?? undefined;
	const primitives = $derived.by(() => {
		const m = maske,
			f = schritt.form;
		return untrack(() => eckBild(m, f, token));
	});
	// Own corners replace the sentence of the running step.
	const schritte = $derived(
		eckSchritte.map((s, i) => ({
			id: s.id,
			titel: eckLoop.namen[s.id],
			text: eigen !== null && i === index ? eckLoop.eigen(maskName(eigen)) : eckLoop.text[s.id]
		}))
	);

	$effect(() => {
		if (spielt) untrack(() => (eigen = null));
	});

	function schalten(m: number) {
		spielt = false;
		eigen = m;
	}
	function pick(id: string | undefined) {
		const ecke = eckAusId(id);
		if (ecke !== undefined) schalten(eckeUmschalten(maske, ecke));
	}
</script>

<FormLoop
	id="formen-ecken"
	label={eckLoop.titel}
	schrittLabel={eckLoop.schritte}
	{schritte}
	dauern={eckDauern}
	bind:t
	bind:spielt
	standbild={3}
	onspringe={() => (eigen = null)}
>
	<Buehne
		{primitives}
		view={slotView}
		drehbar={false}
		verhaeltnis="16 / 10"
		onpick={pick}
		label="{eckLoop.titel}: a quad with eight corners, bottom and top. Occupied corners shape the module."
	/>
	{#snippet extra()}
		<MaskenSchema bind:value={() => maske, schalten} />
	{/snippet}
</FormLoop>
