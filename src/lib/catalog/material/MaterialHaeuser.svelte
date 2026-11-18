<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import { materialHausWahl } from '../data/materialHaeuser';
	import { materialHaus } from '../logic/material/haeuser';
	import Buehne from './Buehne.svelte';

	let haus = $state<string>('timber');
	let oberflaeche = $state('reference');
	let offen = $state('vergleich');
	let buehne = $state<Buehne>();

	const wahl = $derived(materialHausWahl.find((x) => x.value === haus) ?? materialHausWahl[0]);
	const hausWahl = materialHausWahl.map(({ value, label }) => ({ value, label }));
	const finishWahl = $derived([
		{ value: 'reference', label: wahl.oberflaeche },
		{ value: 'comparison', label: wahl.alternative }
	]);
	const finish = $derived(oberflaeche === 'comparison' ? wahl.alternative : wahl.oberflaeche);
	const stuecke = $derived(materialHaus(wahl.value, oberflaeche === 'comparison'));
</script>

<DemoLayout label="Building studies" bind:offen onreset={() => buehne?.zuruecksetzen()}>
	{#snippet bild()}
		<Buehne
			bind:this={buehne}
			{stuecke}
			label="{wahl.label} with {finish}. Drag or arrow keys rotate, scroll wheel or plus and minus zoom."
			hoeheDeg={25}
			azimutDeg={36}
			studio
			lichtVonRechts
			drehen
		/>
	{/snippet}
	{#snippet steuerung()}
		<Steuergruppe wert="vergleich" titel="Building and finish">
			<ChoiceControl
				id="material-haus"
				label="Building"
				bind:value={
					() => haus,
					(wert) => {
						haus = wert;
						oberflaeche = 'reference';
					}
				}
				items={hausWahl}
			/>
			<ChoiceControl
				id="material-haus-finish"
				label="Finish"
				bind:value={oberflaeche}
				items={finishWahl}
			/>
		</Steuergruppe>
	{/snippet}
	{#snippet unterschrift()}
		<p>{wahl.text}</p>
	{/snippet}
</DemoLayout>
