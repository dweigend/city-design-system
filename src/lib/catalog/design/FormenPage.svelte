<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import { Ensemble, FamilieDemo, Teilseiten } from '../formen/traeger';
	import { ensemble, familienTexte, tragwerkeSeite } from '../data/traeger';
</script>

<svelte:head><title>Forms · Structural systems · City Design System</title></svelte:head>
<DesignShell title={tragwerkeSeite.titel}>
	<Teilseiten />
	<Abschnitt id={ensemble.id} titel={ensemble.titel} lead={ensemble.lead}><Ensemble /></Abschnitt>
	{#each familienTexte as texte (texte.id)}<FamilieDemo familie={texte.id} {texte} />{/each}
</DesignShell>

<style>
	:global(#tragwerke) {
		padding-bottom: var(--space-8);
	}
</style>
