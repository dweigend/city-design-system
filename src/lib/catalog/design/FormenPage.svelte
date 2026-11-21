<script lang="ts">
	import { resolve } from '$app/paths';
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
	<Abschnitt id={ensemble.id} titel={ensemble.titel} lead="Lab · {ensemble.lead}">
		<Ensemble />
		<p>
			<a href={resolve('/material#material-formen')}>Envelope and surface treatments</a> ·
			<a href={resolve('/interface#connections')}>From structures to building connections</a>
		</p>
	</Abschnitt>
	{#each familienTexte as texte (texte.id)}
		<FamilieDemo familie={texte.id} texte={{ ...texte, lead: `Lab · ${texte.lead}` }} />
	{/each}
</DesignShell>

<style>
	:global(#tragwerke) {
		padding-bottom: var(--space-8);
	}
	a {
		color: var(--ink);
		text-underline-offset: 0.2em;
	}
</style>
