<script lang="ts">
	import Buehne from './Buehne.svelte';
	import DemoRegler from './DemoRegler.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import { formFokus } from '../data/materialKapitel';
	import { formenSzene } from '../logic/material/schichten';
	import type { PickerZustand } from '../logic/material/picker';

	/**
	 * Form layer: the picked skin on box, dome, tower and new construction on white stock.
	 * Follows the picker read-only. The local form control frames one form alone, close enough
	 * that the skin's grain, joints and gloss read on flat, curved and stacked surfaces.
	 */
	let { zustand, name }: { zustand: PickerZustand; name: string } = $props();
	let fokus = $state<string>('alle');
	const gewaehlt = $derived(formFokus.find((f) => f.value === fokus) ?? formFokus[0]);
	const stuecke = $derived(
		formenSzene(zustand, gewaehlt.value === 'alle' ? undefined : gewaehlt.value)
	);
	const gezeigt = $derived(
		gewaehlt.value === 'alle'
			? 'box, dome, tower and on white existing stock'
			: gewaehlt.label.toLowerCase()
	);
</script>

<Buehne
	{stuecke}
	studio
	lichtVonRechts
	verhaeltnis="16 / 9"
	hoeheDeg={24}
	azimutDeg={30}
	rand={0.05}
	label="{name} on {gezeigt}."
/>
<DemoRegler label="Form and stock">
	<ChoiceControl id="form-fokus" label="Form" items={[...formFokus]} bind:value={fokus} />
</DemoRegler>
