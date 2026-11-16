<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
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
