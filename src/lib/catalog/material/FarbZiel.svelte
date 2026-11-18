<script lang="ts">
	import Buehne from './Buehne.svelte';
	import { farbZielFaelle, farbZielSzene } from '../logic/material/schichten';
	import { pickerHaut } from '../logic/material/picker';
	import { ausfuehrungenVon } from '../logic/material/ausfuehrung';

	/**
	 * Fixed demo of the color-target rule: one flow color on three houses of the same seed.
	 * Pigment takes the glaze; glass and brass keep their look and the color moves to the frames.
	 */
	const stuecke = farbZielSzene();
	const faelle = farbZielFaelle.map((fall) => {
		const name = ausfuehrungenVon(fall.material).find((a) => a.id === fall.textur)?.name;
		const ziel = pickerHaut(fall).farbZiel === 'huelle' ? 'skin' : 'frames';
		return { name, ziel };
	});
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
		label="People pink on {faelle.map((f) => `${f.name}: color on the ${f.ziel}`).join('; ')}."
	/>
	<figcaption>
		{#each faelle as f (f.name)}<span><b>{f.name}</b> color on the {f.ziel}</span>{/each}
	</figcaption>
</figure>

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
