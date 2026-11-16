<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import { FarbeLoop, MaterialLabor, RezeptLoop, TragwerkStufen } from '../material';
	import * as M from '../data/materialSeite';

	/**
	 * Page /material: experiment first. Nine families as TSL recipes on four forms, then
	 * three explainer loops: how a recipe arises from six nodes, how color and material
	 * share the work, and how the material on the structural system recedes with distance.
	 */
</script>

<svelte:head><title>Material · City Design System</title></svelte:head>

<DesignShell title="Material">
	<Abschnitt
		id={M.familienAbschnitt.id}
		titel={M.familienAbschnitt.titel}
		lead={M.familienAbschnitt.lead}
	>
		<MaterialLabor />
	</Abschnitt>

	<Abschnitt
		id={M.rezeptAbschnitt.id}
		titel={M.rezeptAbschnitt.titel}
		lead={M.rezeptAbschnitt.lead}
	>
		<RezeptLoop />
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
