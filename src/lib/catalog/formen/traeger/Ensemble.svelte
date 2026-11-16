<script lang="ts">
	import DemoLayout from '../../bibel/DemoLayout.svelte';
	import Steuergruppe from '../../bibel/Steuergruppe.svelte';
	import SaatZeile from '../../bibel/SaatZeile.svelte';
	import ChoiceControl from '../../labor/ChoiceControl.svelte';
	import { ensemble } from '../../data/traeger';
	import { stadtstueck, type EnsembleFokus } from '../../logic/traeger/ensemble';
	import type { Ansicht } from '../../logic/traeger';
	import TraegerBuehne from './TraegerBuehne.svelte';
	import TraegerLeiste from './TraegerLeiste.svelte';
	let fokus = $state<EnsembleFokus>('alle'),
		saat = $state(42),
		ansicht = $state<Ansicht>('belegt');
	let buehne: TraegerBuehne;
	const modell = $derived(stadtstueck(saat, fokus));
</script>

<div class="ensemble">
	<DemoLayout label="Control the city piece" offen="ansicht" onreset={() => buehne?.reset()}>
		{#snippet bild()}<TraegerLeiste bind:value={fokus} /><TraegerBuehne
				bind:this={buehne}
				plaene={modell.plaene}
				bestand={modell.bestand}
				hochweg={modell.hochweg}
				figuren={modell.figuren}
				{ansicht}
				verhaeltnis="16 / 9"
				mobilVerhaeltnis="16 / 9"
				label="Five structural systems in the city piece"
			/>{/snippet}
		{#snippet steuerung()}<Steuergruppe wert="ansicht" titel="View">
				<ChoiceControl
					id="ensemble-ansicht"
					label="Rendering"
					items={ensemble.ansichten.map((a) => ({ value: a.id, label: a.name }))}
					bind:value={() => ansicht, (v) => (ansicht = v as Ansicht)}
				/>
				<SaatZeile id="ensemble-saat" bind:value={saat} />
			</Steuergruppe>{/snippet}
		{#snippet unterschrift()}<p>{ensemble.unterschrift[fokus]}</p>{/snippet}
	</DemoLayout>
</div>
