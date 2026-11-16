<script lang="ts">
	import DemoLayout from '../bibel/DemoLayout.svelte';
	import Steuergruppe from '../bibel/Steuergruppe.svelte';
	import ChoiceControl from '../labor/ChoiceControl.svelte';
	import Buehne from './Buehne.svelte';
	import FamilienLeiste from './FamilienLeiste.svelte';
	import {
		achsenWahl,
		bestandHinweis,
		familie,
		formWahl,
		type FamilieId,
		type FormId
	} from '../data/materialSeite';
	import { flows } from '../data/focus';
	import { laborSzene } from '../logic/material/formen';
	import { voreinstellung, type Strom, type Wahl } from '../logic/material/rezept';

	/**
	 * Entry point of the Material page: nine families, each a TSL recipe, on box, dome, tower
	 * and existing stock. Family as an image strip at the image; form and flow open, the axes of the
	 * surface collapsible. A new family resets the axes to its levels.
	 */
	const START = { familie: 'beton' as FamilieId, form: 'turm' as FormId, strom: 'water' as Strom };

	let fam = $state<FamilieId>(START.familie),
		form = $state<string>(START.form),
		strom = $state<string>(START.strom),
		wahl = $state<Wahl>(voreinstellung(START.familie, START.strom)),
		offen = $state('form');

	let vorher = START.familie;
	$effect(() => {
		if (fam === vorher) return;
		vorher = fam;
		wahl = voreinstellung(fam, wahl.strom);
	});
	$effect(() => {
		if (wahl.strom !== strom) wahl = { ...wahl, strom: strom as Strom };
	});

	const f = $derived(familie(fam));
	const stuecke = $derived(laborSzene(form as FormId, fam, wahl));
	const stromName = $derived(flows.find((x) => x.id === strom)?.name);
	const stroeme = [
		{ value: 'neutral', label: 'None' },
		...flows.map((x) => ({ value: x.id, label: x.name }))
	];

	let buehne = $state<Buehne>();

	/** Binds an axis to the choice (ChoiceControl delivers strings). */
	function achse<K extends 'rauheit' | 'glanz' | 'deckkraft' | 'kante'>(k: K) {
		return {
			get: () => wahl[k] as string,
			set: (v: string) => (wahl = { ...wahl, [k]: v as Wahl[K] })
		};
	}
	const rau = achse('rauheit'),
		glanz = achse('glanz'),
		deck = achse('deckkraft'),
		kante = achse('kante');

	function zuruecksetzen() {
		fam = START.familie;
		vorher = START.familie;
		form = START.form;
		strom = START.strom;
		wahl = voreinstellung(START.familie, START.strom);
		offen = 'form';
		buehne?.zuruecksetzen();
	}
</script>

<DemoLayout label="Material lab" onreset={zuruecksetzen} bind:offen>
	{#snippet bild()}
		<div class="bild">
			<FamilienLeiste strom={strom as Strom} bind:value={fam} />
			<Buehne
				bind:this={buehne}
				{stuecke}
				drehen
				label="{f.name} on the {formWahl.find((x) => x.value === form)?.label} form{stromName
					? `, flow ${stromName}`
					: ''}. Drag or arrow keys rotate, scroll wheel or plus and minus zoom."
			/>
		</div>
	{/snippet}

	{#snippet steuerung()}
		<Steuergruppe wert="form" titel="Form and flow">
			<ChoiceControl id="material-form" label="Form" bind:value={form} items={formWahl} />
			<ChoiceControl id="material-strom" label="Flow color" bind:value={strom} items={stroeme} />
		</Steuergruppe>
		<Steuergruppe wert="haut" titel="Surface">
			<ChoiceControl
				id="material-rauheit"
				label="Roughness"
				bind:value={rau.get, rau.set}
				items={[...achsenWahl.rauheit]}
			/>
			<ChoiceControl
				id="material-glanz"
				label="Gloss"
				bind:value={glanz.get, glanz.set}
				items={[...achsenWahl.glanz]}
			/>
			<ChoiceControl
				id="material-deckkraft"
				label="Opacity"
				bind:value={deck.get, deck.set}
				items={[...achsenWahl.deckkraft]}
			/>
			<ChoiceControl
				id="material-kante"
				label="Edge rendering"
				bind:value={kante.get, kante.set}
				items={[...achsenWahl.kante]}
			/>
		</Steuergruppe>
	{/snippet}

	{#snippet unterschrift()}
		<p><b>{f.name}.</b> {f.was} {f.rolle}</p>
		{#if f.ohneStrom && strom !== 'neutral'}<p>{f.ohneStrom}</p>{/if}
		{#if form === 'bestand' && fam !== 'bestand'}
			<p>{bestandHinweis}</p>
		{/if}
	{/snippet}
</DemoLayout>

<style>
	.bild {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--paper);
	}
	p + p {
		margin-top: var(--space-2);
	}
	b {
		font-weight: 600;
		color: var(--ink);
	}
</style>
