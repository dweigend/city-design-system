<script lang="ts">
	import DesignShell from './DesignShell.svelte';
	import Abschnitt from '../bibel/Abschnitt.svelte';
	import L13Werkbank from '../labor/L13Werkbank.svelte';
	import { Bedientafel, HudDemo, IconAtlas } from '../interface';
	import TypeScale from '../foundations/TypeScale.svelte';
	import GridSpec from '../foundations/GridSpec.svelte';
	import { typeRoles } from '../data/tokens';
	import * as I from '../data/interface';

	/**
	 * Page /interface: experiment first. The workbench opens a building (views and
	 * motions as context info), then the HUD in Play and Plan with its patterns,
	 * an icon system as a list, the panel of UI controls, finally type and page grid.
	 */
</script>

<svelte:head><title>Interface · City Design System</title></svelte:head>

<DesignShell title="Interface">
	<Abschnitt id={I.oeffnen.id} titel={I.oeffnen.titel} lead={I.oeffnen.lead}>
		<L13Werkbank id="interface-werkbank" />
	</Abschnitt>

	<Abschnitt id={I.hudAbschnitt.id} titel={I.hudAbschnitt.titel} lead={I.hudAbschnitt.lead}>
		<HudDemo />
	</Abschnitt>

	<Abschnitt id={I.iconAbschnitt.id} titel={I.iconAbschnitt.titel} lead={I.iconAbschnitt.lead}>
		<IconAtlas />
	</Abschnitt>

	<Abschnitt
		id={I.bedienAbschnitt.id}
		titel={I.bedienAbschnitt.titel}
		lead={I.bedienAbschnitt.lead}
	>
		<Bedientafel />
	</Abschnitt>

	<Abschnitt
		id={I.schriftAbschnitt.id}
		titel={I.schriftAbschnitt.titel}
		lead={I.schriftAbschnitt.lead}
	>
		<div class="schrift">
			<TypeScale roles={typeRoles} />
			<GridSpec />
		</div>
	</Abschnitt>
</DesignShell>

<style>
	.schrift {
		display: flex;
		flex-direction: column;
		gap: var(--space-10);
	}
</style>
