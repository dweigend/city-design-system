<script lang="ts">
	import { resolve } from '$app/paths';
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import LayerDiagram from '../bibel/LayerDiagram.svelte';
	import PrincipleList from '../bibel/PrincipleList.svelte';
	import L11Welt from '../labor/L11Welt.svelte';
	import OperatorStudien from '../labor/OperatorStudien.svelte';
	import LeitstilSpektrum from '../labor/LeitstilSpektrum.svelte';
	import * as P from '../data/prinzipien';
	import * as Lab from '../data/labor';

	/**
	 * Page /labor: first the full simulation with presets, then “How the city
	 * computes” (layers and twelve principles, each with its experiment: in the chapter or here in
	 * the simulation), finally two standalone operator studies. All other trials live in
	 * their chapters. Takes over the former page /prinzipien.
	 */
	let welt = $state<ReturnType<typeof L11Welt>>();
</script>

<svelte:head><title>Lab · City Design System</title></svelte:head>

<DesignShell title="Lab">
	<Abschnitt id={Lab.simulation.id} titel={Lab.simulation.titel} lead={Lab.simulation.lead}>
		<L11Welt bind:this={welt} />
	</Abschnitt>

	<Abschnitt id={Lab.rechnen.id} titel={Lab.rechnen.titel} lead={Lab.rechnen.lead}>
		<div class="rechnen">
			<LayerDiagram layers={P.schichten} steps={P.schichtSchritte} back={P.schichtRueckweg} />
			<PrincipleList
				items={P.prinzipien}
				experimente={Lab.experimente}
				onsimulation={(id) => welt?.waehle(id, true)}
			/>
		</div>
	</Abschnitt>

	<Abschnitt id={Lab.studien.id} titel={Lab.studien.titel} lead={Lab.studien.lead}>
		<OperatorStudien />
		<a href={resolve('/labor/building-envelope')}>Roof geometry on three cell shapes</a>
	</Abschnitt>
	<Abschnitt id={Lab.leitstil.id} titel={Lab.leitstil.titel} lead={Lab.leitstil.lead}>
		<LeitstilSpektrum />
	</Abschnitt>
</DesignShell>

<style>
	.rechnen {
		display: flex;
		flex-direction: column;
		gap: var(--space-12);
	}
</style>
