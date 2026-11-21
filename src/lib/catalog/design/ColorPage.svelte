<script lang="ts">
	import { resolve } from '$app/paths';
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import DesignPrinciples from '../bibel/DesignPrinciples.svelte';
	import FarbLabor from '../color/FarbLabor.svelte';
	import FarbMatrix from '../color/FarbMatrix.svelte';
	import DataTable from '../bibel/DataTable.svelte';
	import * as C from '../data/color';

	/**
	 * Page /farben: two statements, one presentation each, then the design rules for reference.
	 * One color per function (color lab, controls on the right) · five flows, five steps (matrix) ·
	 * all values, contrasts and tokens bundled in one table at the end of the page.
	 */
</script>

<svelte:head><title>Color · City Design System</title></svelte:head>

<DesignShell title="Color">
	<p class="phase-note">
		Construction phases (<a href={resolve('/formen#construction-phases')}>Forms</a>) govern surfaces
		and colors alongside <a href={resolve('/farben#COLOR-4')}>COLOR-4</a> and
		<a href={resolve('/farben#COLOR-5')}>COLOR-5</a>, which shows older phases as stock: plain
		volumes and pencil drawings without use color.
	</p>
	<DesignPrinciples page="color" />

	<Abschnitt id="farbe-ruhig" titel={C.ruhig.titel} lead={C.ruhig.lead}>
		<FarbLabor text={C.ruhig.bild} />
	</Abschnitt>

	<Abschnitt id="farbe-stroeme" titel={C.stroeme.titel} lead={C.stroeme.lead}>
		<FarbMatrix
			reihen={C.reihen}
			akzente={C.akzente}
			enden={C.enden}
			akzenteText={C.stroeme.akzente}
		/>
	</Abschnitt>

	<Abschnitt id="farbe-regeln" titel="Design rules">
		<DataTable
			label="Design rules color"
			columns={[
				{ key: 'bereich', label: 'Area' },
				{ key: 'regel', label: 'Rule' },
				{ key: 'wert', label: 'Value' },
				{ key: 'token', label: 'Token' }
			]}
			rows={C.designregeln}
			mono={['token']}
		/>
	</Abschnitt>
</DesignShell>

<style>
	.phase-note {
		max-width: 68ch;
		margin-bottom: var(--space-4);
		color: var(--ink-2);
		font-size: var(--text-s);
		line-height: 1.5;
	}
	.phase-note a {
		color: var(--ink);
		text-underline-offset: 0.2em;
	}
</style>
