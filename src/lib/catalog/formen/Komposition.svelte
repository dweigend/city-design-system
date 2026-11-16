<script lang="ts">
	import BildSatz from './BildSatz.svelte';
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import SaatZeile from '../bibel/SaatZeile.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Scale from '../ui/Scale.svelte';
	import Buehne from './turm/Buehne.svelte';
	import { formGroups } from '../logic/parametrik/formen';
	import type { FormGroup } from '../logic/parametrik/vocab';
	import {
		KOERPER,
		REGELN,
		komposition,
		kompositionsRaster,
		startKomposition,
		type KompositionWahl,
		type RegelId
	} from '../logic/formen';
	import { komposition as abschnitt, regelText } from '../data/formen';

	/**
	 * Composition: a rule reads the neighborhood of every cell and places forms. On the right the
	 * rule (open), grid, form group, occupancy and seed collapsible; below it the sentence of the rule.
	 */
	let wahl = $state<KompositionWahl>({ ...startKomposition });
	let offen = $state('regel');
	let buehne = $state<Buehne>();
	const primitives = $derived(komposition(wahl));
	const regelItems = REGELN.map((r) => ({ value: r, label: regelText[r].name }));
	const rasterItems = kompositionsRaster.map((g) => ({ value: g.kind, label: g.name }));
	const gruppenItems = KOERPER.map((g) => ({
		value: g,
		label: formGroups.find((x) => x.id === g)?.name ?? g
	}));
	const setze = (teil: Partial<KompositionWahl>) => (wahl = { ...wahl, ...teil });
	const prozent = (v: number) => `${Math.round(v * 100)} %`;

	function reset() {
		wahl = { ...startKomposition };
		offen = 'regel';
		buehne?.reset();
	}
</script>

<DemoLayout label={abschnitt.titel} onreset={reset} resetLabel="Reset" bind:offen>
	{#snippet bild()}
		<div class="bild">
			<Buehne
				bind:this={buehne}
				{primitives}
				label="{regelText[wahl.regel].name}: forms on a grid of cells."
			/>
			<BildSatz name={regelText[wahl.regel].name} text={regelText[wahl.regel].satz} />
		</div>
	{/snippet}
	{#snippet steuerung()}
		<Steuergruppe wert="regel" titel="Rule">
			<ChoiceControl
				id="komposition-regel"
				label="Rule"
				bind:value={() => wahl.regel, (v) => setze({ regel: v as RegelId })}
				items={regelItems}
			/>
			{#if wahl.regel === 'geruest'}
				<Scale
					live
					label="Occupancy"
					bind:value={() => wahl.belegung, (v) => setze({ belegung: v })}
					min={0}
					max={1}
					step={0.05}
					format={prozent}
				/>
			{:else}
				<ChoiceControl
					id="komposition-gruppe"
					label="Form group"
					bind:value={() => wahl.gruppe, (v) => setze({ gruppe: v as FormGroup })}
					items={gruppenItems}
				/>
			{/if}
		</Steuergruppe>
		<Steuergruppe wert="fein" titel="Grid and seed">
			<ChoiceControl
				id="komposition-raster"
				label="Grid"
				bind:value={() => wahl.raster, (v) => setze({ raster: v })}
				items={rasterItems}
			/>
			<SaatZeile bind:value={() => wahl.saat, (v) => setze({ saat: v })} id="komposition-saat" />
		</Steuergruppe>
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
</style>
