<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import DataTable from '../bibel/DataTable.svelte';
	import L14Formlabor from '../labor/L14Formlabor.svelte';
	import { formlaborKosten, formlaborPrinzipien } from '../data/formlabor';
	import { typen } from '../logic/parametrik/formlabor';

	const typTafel = typen.map((t) => ({ begriff: t.name, text: t.text, formel: `Ref. ${t.ref}` }));
</script>

<svelte:head><title>Form lab · City Designbook</title></svelte:head>
<DesignShell title="Form lab">
	<Abschnitt id="L14" titel="Form lab: one primal form, eight types"><L14Formlabor /></Abschnitt>
	<Abschnitt id="prinzipien" titel="Six principles">
		<ol>
			{#each formlaborPrinzipien as text (text)}<li>{text}</li>{/each}
		</ol>
	</Abschnitt>
	<Abschnitt id="typen" titel="Types as points in parameter space">
		<DataTable
			label="Eight types"
			rows={typTafel}
			columns={[
				{ key: 'begriff', label: 'Type' },
				{ key: 'text', label: 'Rule' },
				{ key: 'formel', label: 'Reference' }
			]}
		/>
	</Abschnitt>
	<Abschnitt id="kosten" titel="What a slider costs">
		<DataTable
			label="Cost per slider"
			rows={formlaborKosten}
			columns={[
				{ key: 'begriff', label: 'Slider' },
				{ key: 'text', label: 'Effect' },
				{ key: 'formel', label: 'Cost' }
			]}
		/>
	</Abschnitt>
</DesignShell>
