<script lang="ts">
	import Buehne from './Buehne.svelte';
	import { probeSzene } from '../logic/material/studien';
	import { voreinstellung } from '../logic/material/rezept';

	/** Time layer: the water specimen, the one surface that moves. Fixed; still under reduced motion. */
	const stuecke = probeSzene('wasser', voreinstellung('wasser', 'neutral'));
</script>

<Buehne
	{stuecke}
	studio
	lichtVonRechts
	verhaeltnis="16 / 9"
	hoeheDeg={28}
	azimutDeg={32}
	label="Shallow water with slow crossing ripples above a submerged landing."
/>
