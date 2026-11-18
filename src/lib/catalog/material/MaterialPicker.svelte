<script lang="ts">
	import Button from '../ui/Button.svelte';
	import Buehne from './Buehne.svelte';
	import MaterialRad from './MaterialRad.svelte';
	import {
		pickerRaeder,
		pickerSzene,
		waehlePicker,
		type PickerFeld,
		type PickerZustand
	} from '../logic/material/picker';
	import { lupenSzene } from '../logic/material/schichten';

	/**
	 * The page's one live Material Picker. Three independent wheels (Material, Color, Texture)
	 * dress a row of seeded houses on one fixed studio view, plus a close-up loupe of the skin.
	 * Wheels never move geometry, so the view holds; only "New houses" reframes. The stage does
	 * not orbit, so touch scrolling and the mouse wheel pass over it. State changes go through
	 * `waehlePicker`.
	 */
	let { zustand = $bindable() }: { zustand: PickerZustand } = $props();

	/** Seeds cycle through 1–16 so every set of houses can be reached again. */
	const SAATEN = 16;
	const raeder = $derived(pickerRaeder(zustand));
	const szene = $derived(pickerSzene(zustand));
	const lupe = $derived(lupenSzene(zustand));
	const textur = $derived(raeder.textur.find((o) => o.value === zustand.textur)?.label);
	const nummer = $derived(String(zustand.saat).padStart(2, '0'));

	function waehle(feld: PickerFeld, wert: string | number) {
		zustand = waehlePicker(zustand, feld, wert);
	}
</script>

<div class="picker" data-picker>
	<div class="bild">
		<Buehne
			stuecke={szene.stuecke}
			studio
			lichtVonRechts
			verhaeltnis="16 / 10"
			hoeheDeg={26}
			azimutDeg={34}
			rand={0.06}
			label="Three houses. {szene.haut.status}."
		/>
	</div>
	<div class="seite">
		<div class="raeder">
			<MaterialRad
				id="rad-material"
				label="Material"
				options={raeder.material}
				value={zustand.material}
				onwaehle={(v) => waehle('material', v)}
			/>
			<MaterialRad
				id="rad-farbe"
				label="Color"
				options={raeder.farbe}
				value={zustand.farbe}
				onwaehle={(v) => waehle('farbe', v)}
			/>
			<MaterialRad
				id="rad-textur"
				label="Texture"
				options={raeder.textur}
				value={zustand.textur}
				onwaehle={(v) => waehle('textur', v)}
			/>
		</div>
		<p class="status" role="status" data-status>{szene.haut.status}</p>
		<Button
			variant="secondary"
			label="New houses · {nummer}"
			data-neue-haeuser
			onclick={() => waehle('saat', (zustand.saat % SAATEN) + 1)}
		/>
		<div class="lupe" data-lupe>
			<Buehne
				stuecke={lupe}
				studio
				lichtVonRechts
				verhaeltnis="2 / 1"
				hoeheDeg={14}
				azimutDeg={30}
				rand={0.04}
				label="Close-up of {textur} on a wall corner."
			/>
		</div>
	</div>
</div>

<style>
	/* Desktop: stage in 2 of 3 columns, wheels beside it, so all three fit the first 768 px. */
	.picker {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-4) var(--space-8);
		align-items: start;
	}
	.bild,
	.seite {
		min-width: 0;
	}
	.seite {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-4);
	}
	.raeder {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	/* Two lines reserved, so a longer status never shifts the loupe. */
	.status {
		min-height: 2.6em;
		font-size: var(--text-xs);
		line-height: 1.3;
		color: var(--ink-2);
	}
	@media (max-width: 960px) {
		.picker {
			grid-template-columns: minmax(0, 1fr);
		}
		.raeder {
			gap: var(--space-3);
		}
	}
</style>
