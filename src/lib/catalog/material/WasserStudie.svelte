<script lang="ts">
	import Buehne from './Buehne.svelte';
	import DemoRegler from './DemoRegler.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import { wasserBlicke } from '../data/materialKapitel';
	import { probeSzene } from '../logic/material/studien';
	import { voreinstellung } from '../logic/material/rezept';

	/**
	 * Time layer: the water specimen, the one surface that moves. The local view control changes
	 * the viewing height: from above the landing shows through, toward grazing the sky reflects.
	 * Each view opens a fresh stage, so the seeded ripples start again. The canvas stays scrollable.
	 * Still under reduced motion.
	 */
	const stuecke = probeSzene('wasser', voreinstellung('wasser', 'neutral'));
	let blick = $state<string>('schraeg');
	const gewaehlt = $derived(wasserBlicke.find((b) => b.value === blick) ?? wasserBlicke[1]);
</script>

{#key gewaehlt.value}
	<Buehne
		{stuecke}
		studio
		verhaeltnis="16 / 9"
		hoeheDeg={gewaehlt.hoeheDeg}
		azimutDeg={32}
		label="Shallow water with slow crossing ripples above a submerged landing, seen {gewaehlt.label.toLowerCase()}."
	/>
{/key}
<DemoRegler label="Water">
	<ChoiceControl id="wasser-blick" label="View" items={[...wasserBlicke]} bind:value={blick} />
</DemoRegler>
