<script lang="ts">
	import { resolve } from '$app/paths';
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import DesignPrinciples from '../bibel/DesignPrinciples.svelte';
	import VerfahrenMatrix from '../bibel/VerfahrenMatrix.svelte';
	import WachstumDemo from '../modellierung/WachstumDemo.svelte';
	import FeldDemo from '../modellierung/FeldDemo.svelte';
	import SplitDemo from '../modellierung/SplitDemo.svelte';
	import ParzellenDemo from '../modellierung/ParzellenDemo.svelte';
	import WfcDemo from '../modellierung/WfcDemo.svelte';
	import * as W from '../data/wachstum';

	/**
	 * Page /wachstum (replaces /modellierung): experiment first. Paths grow, blocks are the
	 * remainder; fields steer; a block splits; lots hang on access points and change
	 * over eras; WFC chooses among variants. At the end the matrix: which method for what.
	 * Elevated walkways (City), universal grid and carrier (Grid), corner modules and cage (Forms) live
	 * in their chapters; the matrix links there.
	 */
	const verfahren = W.verfahren.map((v) => ({ id: v.id, titel: v.titel, anker: v.ziel }));
</script>

<svelte:head><title>Growth · City Design System</title></svelte:head>

<DesignShell title="Growth">
	<p>
		<a href={resolve('/raster')}>Compare one generation at the square</a> · In the game
	</p>
	<DesignPrinciples page="growth" />

	<Abschnitt id={W.wegeZuerst.id} titel={W.wegeZuerst.titel} lead={W.wegeZuerst.lead}>
		<WachstumDemo />
	</Abschnitt>

	<Abschnitt id={W.felder.id} titel={W.felder.titel} lead={W.felder.lead}>
		<FeldDemo />
	</Abschnitt>

	<Abschnitt id={W.teilen.id} titel={W.teilen.titel} lead={W.teilen.lead}>
		<SplitDemo />
	</Abschnitt>

	<Abschnitt id={W.parzellen.id} titel={W.parzellen.titel} lead={W.parzellen.lead}>
		<ParzellenDemo />
	</Abschnitt>

	<Abschnitt id={W.wfc.id} titel={W.wfc.titel} lead={W.wfc.lead}>
		<WfcDemo />
	</Abschnitt>

	<Abschnitt id={W.matrix.id} titel={W.matrix.titel} lead={W.matrix.lead}>
		<VerfahrenMatrix {verfahren} aufgaben={W.aufgaben} label="Which method for which task" />
	</Abschnitt>
</DesignShell>
