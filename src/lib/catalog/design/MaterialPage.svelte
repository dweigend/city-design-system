<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import {
		FarbeLoop,
		MaterialHaeuser,
		MaterialIndex,
		MaterialLabor,
		MaterialTeil,
		RezeptLoop,
		TragwerkStufen
	} from '../material';
	import * as M from '../data/materialSeite';
	import { erklaerungTeil, haeuserAbschnitt } from '../data/materialKapitel';

	import {
		materialStart,
		materialWerkstatt,
		waehleMaterial,
		type MaterialWahl
	} from '../logic/material/werkstatt';

	let auswahl = $state.raw(materialStart());
	const werkstatt = $derived(materialWerkstatt(auswahl));
	const waehle: MaterialWahl = (feld, wert) => {
		auswahl = waehleMaterial(auswahl, feld, wert);
	};

	/**
	 * Material chapter in two parts: the surface workflow (specimens, finishes, buildings),
	 * then the teaching studies (recipe, color, detail levels). Section anchors are stable.
	 */
</script>

<svelte:head><title>Material · City Design System</title></svelte:head>

<DesignShell title="Material">
	<MaterialIndex />

	<Abschnitt
		id={M.familienAbschnitt.id}
		titel={M.familienAbschnitt.titel}
		lead={M.familienAbschnitt.lead}
	>
		<MaterialLabor {werkstatt} {waehle} onreset={() => (auswahl = materialStart())} />
	</Abschnitt>

	<Abschnitt id={haeuserAbschnitt.id} titel={haeuserAbschnitt.titel} lead={haeuserAbschnitt.lead}>
		<MaterialHaeuser />
	</Abschnitt>

	<MaterialTeil {...erklaerungTeil} />

	<Abschnitt
		id={M.rezeptAbschnitt.id}
		titel={M.rezeptAbschnitt.titel}
		lead={M.rezeptAbschnitt.lead}
	>
		<RezeptLoop {werkstatt} {waehle} />
	</Abschnitt>

	<Abschnitt id={M.farbeAbschnitt.id} titel={M.farbeAbschnitt.titel} lead={M.farbeAbschnitt.lead}>
		<FarbeLoop />
	</Abschnitt>

	<Abschnitt
		id={M.stufenAbschnitt.id}
		titel={M.stufenAbschnitt.titel}
		lead={M.stufenAbschnitt.lead}
	>
		<TragwerkStufen />
	</Abschnitt>
</DesignShell>
