<script lang="ts">
	import CourtStudy from '../raster/CourtStudy.svelte';
	import type { CourtStudy as Study } from '../raster/court-study.server';
	let { study }: { study: Study } = $props();
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import DesignPrinciples from '../bibel/DesignPrinciples.svelte';
	import { RasterLabor, SpielraumLoop, ViereckLoop } from '../raster';
	import * as R from '../data/raster';

	/**
	 * Page /raster: experiment first. Nine grids and their layers in one simulation,
	 * then two explainer loops: every polygon becomes quads; the mesh moves, the rules
	 * stay. Corner modules, build cell and mask live under Forms.
	 */
</script>

<svelte:head><title>Grid · City Design System</title></svelte:head>

<DesignShell title="Grid" showTitle={false}>
	<CourtStudy {study} />
	<DesignPrinciples page="grid" />

	<Abschnitt id={R.grund.id} titel={R.grund.titel} lead={R.grund.lead}>
		<RasterLabor />
	</Abschnitt>

	<Abschnitt id={R.vierecke.id} titel={R.vierecke.titel} lead={R.vierecke.lead}>
		<ViereckLoop />
	</Abschnitt>

	<Abschnitt id={R.spielraum.id} titel={R.spielraum.titel} lead={R.spielraum.lead}>
		<SpielraumLoop />
	</Abschnitt>
</DesignShell>
