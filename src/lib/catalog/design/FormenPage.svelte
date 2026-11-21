<script lang="ts">
	import { VolumeStudy } from '../formen';
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import DesignPrinciples from '../bibel/DesignPrinciples.svelte';
	import { Ensemble, FamilieDemo, Teilseiten } from '../formen/traeger';
	import { ensemble, familienTexte } from '../data/traeger';
</script>

<svelte:head><title>Forms · Solid and void · City Design System</title></svelte:head>
<DesignShell title="Forms" showTitle={false}>
	<VolumeStudy />

	<Teilseiten />
	<DesignPrinciples page="forms" />
	<Abschnitt id={ensemble.id} titel={ensemble.titel} lead={ensemble.lead}><Ensemble /></Abschnitt>
	{#each familienTexte as texte (texte.id)}<FamilieDemo familie={texte.id} {texte} />{/each}
</DesignShell>

<style>
	:global(#tragwerke) {
		padding-bottom: var(--space-8);
	}
</style>
