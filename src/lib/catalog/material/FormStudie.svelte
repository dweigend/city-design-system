<script lang="ts">
	import Buehne from './Buehne.svelte';
	import { formenSzene } from '../logic/material/schichten';
	import type { PickerZustand } from '../logic/material/picker';

	/**
	 * Form layer: the picked skin on box, dome, tower and new construction on white stock.
	 * Follows the picker read-only; the caption names the state it shows.
	 */
	let { zustand, name }: { zustand: PickerZustand; name: string } = $props();
	const stuecke = $derived(formenSzene(zustand));
</script>

<Buehne
	{stuecke}
	studio
	lichtVonRechts
	verhaeltnis="16 / 9"
	hoeheDeg={24}
	azimutDeg={30}
	rand={0.05}
	label="{name} on box, dome, tower and on white existing stock."
/>
