<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { resolve } from '$app/paths';
	import { X } from 'lucide-svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import DesignPrinciples from '../bibel/DesignPrinciples.svelte';
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
	<section id="library-path" class="library-path" aria-labelledby="library-title">
		<h2 id="library-title">Shared library in use</h2>
		<p>
			<strong>Status labels.</strong> <strong>Game</strong> = sandbox code path (<a
				href={resolve('/sandbox')}>/sandbox</a
			>); <strong>Prototype</strong> = City Game prototype module; <strong>Lab</strong> = external
			experiment; <strong>Bible study</strong> = fixture authored for a single bible picture;
			<strong>Planned</strong> = scheduled work with issue number.
		</p>
		<p>
			<strong>Game.</strong> The sandbox builds ground paths, footbridges over alleys, court approaches
			and rail from typed movement ports and edges. Its corridor projection reads the same surveyed alignment
			as the graph. House parts and palette roles already serve bible views and the sandbox.
		</p>
		<p>
			<a href={resolve('/formen#volume-section')}>House and court</a> shows how the cell space, occupancy
			and house recipe fit together on the shared stage.
		</p>
		<p>
			<strong>Prototype.</strong> The City Game Infrastructure Atlas prototype traces water and power
			from supply nodes to building fittings (sandbox planned, ST14 #38) and validates tessellated volume
			houses (VOLUME-VERIFICATION).
		</p>
		<p>
			<strong>Bible studies to replace.</strong> City scenes (<code>logic/stadt/*</code>), the
			connection fixture (<code>logic/connection-study/fixture.ts</code>), the construction phase
			houses (<code>logic/style-house</code>), and the server-side court survey (<code
				>raster/court-study.server.ts</code
			>) still run outside the sandbox until replaced by the
			<a href={resolve('/interface#engine-path')}>shared engine miniatures</a> (ST6 #36, ST12 #37, ST14
			#38, ST15 #39).
		</p>
	</section>
	<DesignPrinciples page="library" />
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
	.library-path {
		display: grid;
		gap: var(--space-2);
		max-width: 66ch;
		margin-block-end: var(--space-6);
	}
	.library-path h2 {
		font-size: var(--text-m);
		font-weight: 600;
	}
	.library-path p {
		font-size: var(--text-s);
		line-height: 1.5;
	}
	.library-path a {
		color: var(--ink);
		text-underline-offset: 0.18em;
	}
	.library-path a:hover {
		text-decoration-thickness: var(--stroke);
	}
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
