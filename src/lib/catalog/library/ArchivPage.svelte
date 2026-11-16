<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { X } from 'lucide-svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import DesignShell from '../design/DesignShell.svelte';
	import FilterBar from './FilterBar.svelte';
	import ArchivRaster from './ArchivRaster.svelte';
	import ArchivDetail from './ArchivDetail.svelte';
	import { archiv } from '../data/archiv';
	import { activeTerms, applyFilter, emptyFilter, toggleTerm, type Facet } from './filter';

	/**
	 * Archive: all images in one grid, at the top the filter bar with provenance and terms.
	 * Wide: the selected image stands beside it on the right and stays in place while scrolling; narrow:
	 * it opens as a sheet above the grid.
	 */
	let filter = $state(emptyFilter());
	let gewaehlt = $state<string>();
	let offen = $state(false);
	let leiste = $state(0);
	const breit = new MediaQuery('min-width: 1024px');

	const shown = $derived(applyFilter(archiv, filter));
	const active = $derived(activeTerms(filter).map((c) => c.term));
	// Wide: an image is always selected: the clicked one, as long as it stays in the filter, otherwise the first.
	const aktuell = $derived(
		shown.find((a) => a.key === gewaehlt) ?? (breit.current ? shown[0] : undefined)
	);

	function waehle(key: string) {
		gewaehlt = key;
		if (!breit.current) offen = true;
	}
	function filtere(key: Facet, term: string) {
		filter = toggleTerm(filter, key, term);
		offen = false;
	}
	$effect(() => {
		if (breit.current) offen = false;
	});
</script>

<svelte:head><title>Archive · City Design System</title></svelte:head>

<DesignShell title="Archive">
	<FilterBar items={archiv} bind:filter shown={shown.length} bind:hoehe={leiste} />
	<div class="archiv" style:--leiste="{leiste}px">
		<ArchivRaster items={shown} selected={aktuell?.key} onselect={waehle} />
		{#if breit.current && aktuell}
			<aside class="seite" aria-label="Selected image">
				<ArchivDetail item={aktuell} {active} onterm={filtere} />
			</aside>
		{/if}
	</div>
</DesignShell>

{#if !breit.current}
	<Dialog.Root bind:open={offen}>
		<Dialog.Portal>
			<Dialog.Overlay class="cg-archiv-overlay" />
			<Dialog.Content class="cg-archiv-blatt">
				{#if aktuell}
					<Dialog.Close class="cg-archiv-zu" aria-label="Close"><X size={18} /></Dialog.Close>
					<ArchivDetail item={aktuell} {active} onterm={filtere}>
						{#snippet titel(t)}<Dialog.Title class="cg-archiv-titel">{t}</Dialog.Title>{/snippet}
					</ArchivDetail>
				{/if}
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}

<style>
	.archiv {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-8);
		align-items: start;
	}
	/* Stays below the filter bar and scrolls on its own when the detail is long. */
	.seite {
		position: sticky;
		top: calc(var(--leiste) + var(--space-4));
		max-height: calc(100vh - var(--leiste) - var(--space-6));
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-bottom: var(--space-4);
	}
	@media (max-width: 1023px) {
		.archiv {
			grid-template-columns: 1fr;
		}
	}

	:global(.cg-archiv-overlay) {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: color-mix(in srgb, var(--paper) 85%, transparent);
	}
	:global(.cg-archiv-blatt) {
		position: fixed;
		inset: var(--space-2);
		z-index: 51;
		overflow-y: auto;
		padding: var(--space-4);
		padding-top: var(--space-12);
		border: var(--hair) solid var(--ink);
		background: var(--paper);
	}
	:global(.cg-archiv-blatt:focus) {
		outline: none;
	}
	:global(.cg-archiv-zu) {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		display: grid;
		place-items: center;
		width: var(--ctl-m);
		height: var(--ctl-m);
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		cursor: pointer;
	}
	:global(.cg-archiv-titel) {
		flex: 1;
		font-size: var(--text-m);
		font-weight: 600;
		line-height: 1.25;
	}
</style>
