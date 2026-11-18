<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import {
		DemoKarte,
		FarbeLoop,
		FarbZiel,
		FormStudie,
		MaterialPicker,
		RezeptLoop,
		TragwerkStufen,
		WasserStudie
	} from '../material';
	import * as K from '../data/materialKapitel';
	import { ausfuehrungenVon } from '../logic/material/ausfuehrung';
	import { pickerStart } from '../logic/material/picker';
	import { pickerDiagrammRezept } from '../logic/material/schichten';

	/**
	 * Material chapter: the one live picker first, then six compact layer demos in two columns.
	 * Demos read the picker state but never change it. Section anchors are stable.
	 */
	let zustand = $state.raw(pickerStart());
	const diagramm = $derived(pickerDiagrammRezept(zustand));
	const finish = $derived(
		ausfuehrungenVon(zustand.material).find((a) => a.id === zustand.textur)?.name ?? ''
	);
</script>

<svelte:head><title>Material · City Design System</title></svelte:head>

<DesignShell title="Material" showTitle={false}>
	<section id={K.pickerAbschnitt.id} aria-label={K.pickerAbschnitt.titel}>
		<MaterialPicker bind:zustand />
	</section>

	<div class="demos">
		<DemoKarte {...K.farbZielKarte}><FarbZiel /></DemoKarte>
		<DemoKarte {...K.formKarte} text="{finish}. {K.formKarte.text}">
			<FormStudie {zustand} name={finish} />
		</DemoKarte>
		<DemoKarte {...K.rezeptKarte} breit>
			<RezeptLoop rezept={diagramm} {finish} />
		</DemoKarte>
		<DemoKarte {...K.farbeKarte}><FarbeLoop /></DemoKarte>
		<DemoKarte {...K.wasserKarte}><WasserStudie /></DemoKarte>
		<DemoKarte {...K.stufenKarte} breit><TragwerkStufen /></DemoKarte>
	</div>
</DesignShell>

<style>
	/* Six demo cards in two columns below the picker; one column on narrow screens. */
	.demos {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-12) var(--space-8);
		margin-top: var(--space-16);
		padding-bottom: var(--space-20);
	}
	@media (max-width: 960px) {
		.demos {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-10);
			margin-top: var(--space-12);
		}
	}
</style>
