<script lang="ts">
	import Buehne from './Buehne.svelte';
	import DemoRegler from './DemoRegler.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import { farbZielSchalter } from '../data/materialKapitel';
	import { farbZielFaelle, farbZielSzene } from '../logic/material/schichten';
	import { pickerHaut } from '../logic/material/picker';
	import { ausfuehrungenVon } from '../logic/material/ausfuehrung';

	/**
	 * Demo of the color-target rule: three houses of the same seed, switched between their natural
	 * finish and one flow color. Pigment takes the glaze; glass and brass keep their look and the
	 * color moves to the frames. The switch is local: it never touches the picker above.
	 */
	let farbe = $state<string>('people');
	const faelle = $derived(
		farbZielFaelle.map((fall) => ({ ...fall, farbe: farbe === 'natur' ? 'natur' : fall.farbe }))
	);
	const stuecke = $derived(farbZielSzene(faelle));
	const ziele = $derived(
		faelle.map((fall) => {
			const name = ausfuehrungenVon(fall.material).find((a) => a.id === fall.textur)?.name;
			const ziel =
				fall.farbe === 'natur'
					? 'own color'
					: pickerHaut(fall).farbZiel === 'huelle'
						? 'color on the skin'
						: 'color on the base';
			return { name, ziel };
		})
	);
	const farbName = $derived(farbZielSchalter.find((o) => o.value === farbe)?.label ?? '');
</script>

<figure class="farbziel" data-demo="farbziel">
	<Buehne
		{stuecke}
		studio
		lichtVonRechts
		verhaeltnis="16 / 7"
		hoeheDeg={24}
		azimutDeg={30}
		rand={0.05}
		label="{farbName}: {ziele.map((f) => `${f.name}, ${f.ziel}`).join('; ')}."
	/>
	<figcaption aria-live="polite">
		{#each ziele as f (f.name)}<span><b>{f.name}</b> {f.ziel}</span>{/each}
	</figcaption>
</figure>
<DemoRegler label="Where color goes">
	<ChoiceControl
		id="farbziel-farbe"
		label="Flow color"
		items={[...farbZielSchalter]}
		bind:value={farbe}
	/>
</DemoRegler>

<style>
	.farbziel {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
	}
	figcaption {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-2);
		font-size: var(--text-xs);
		color: var(--ink-2);
		text-align: center;
	}
	b {
		display: block;
		font-weight: 600;
		color: var(--ink);
	}
</style>
