<script lang="ts">
	import { X } from 'lucide-svelte';
	import FacetPopover from './FacetPopover.svelte';
	import HerkunftWahl from './HerkunftWahl.svelte';
	import type { ArchivItem } from '../data/archiv';
	import {
		activeTerms,
		emptyFilter,
		facetLabels,
		facetTerms,
		facets,
		toggleTerm,
		type ArchivFilter
	} from './filter';

	/**
	 * Fixed bar above the grid: provenance, facets, hit count; active terms removable
	 * one by one. A facet appears only if it has terms under the selected provenance.
	 */
	let {
		items,
		filter = $bindable(),
		shown,
		hoehe = $bindable(0)
	}: { items: ArchivItem[]; filter: ArchivFilter; shown: number; hoehe?: number } = $props();

	const chips = $derived(activeTerms(filter));
	// Provenance resets “All”; the row appears only for terms.
	const dirty = $derived(chips.length > 0);
	const sichtbar = $derived(
		facets
			.map((key) => ({
				key,
				terms: facetTerms(
					items.filter((i) => !filter.herkunft || i.herkunft === filter.herkunft),
					filter,
					key
				)
			}))
			.filter((f) => f.terms.length > 0 || filter[f.key].length > 0)
	);
</script>

<div class="bar" role="search" aria-label="Filter the archive" bind:offsetHeight={hoehe}>
	<div class="row">
		<HerkunftWahl {items} bind:filter />
		<div class="facets">
			{#each sichtbar as f (f.key)}
				<FacetPopover
					label={facetLabels[f.key]}
					terms={f.terms}
					selected={filter[f.key]}
					ontoggle={(t) => (filter = toggleTerm(filter, f.key, t))}
				/>
			{/each}
		</div>
		<p class="count" aria-live="polite">
			<strong>{shown}</strong>
			{shown === items.length ? 'images' : `of ${items.length} images`}
		</p>
	</div>
	{#if dirty}
		<ul class="chips" aria-label="Active filters">
			{#each chips as c (c.key + c.term)}
				<li>
					<button
						type="button"
						onclick={() => (filter = toggleTerm(filter, c.key, c.term))}
						aria-label={`Remove ${facetLabels[c.key]} ${c.term}`}
					>
						<span class="facet">{facetLabels[c.key]}</span>
						{c.term}
						<X size={12} strokeWidth={1.75} aria-hidden="true" />
					</button>
				</li>
			{/each}
			<li>
				<button type="button" class="reset" onclick={() => (filter = emptyFilter())}
					>Remove all filters</button
				>
			</li>
		</ul>
	{/if}
</div>

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-8);
		padding: var(--space-3) 0;
		border-bottom: var(--hair) solid var(--line);
		background: var(--paper);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-4);
	}
	.facets {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.count {
		margin: 0 0 0 auto;
		font-size: var(--text-s);
		color: var(--ink-2);
		white-space: nowrap;
	}
	.count strong {
		font-family: var(--font-mono);
		font-weight: 500;
		color: var(--ink);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chips button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: calc(var(--ctl-s) + var(--space-2));
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		font-size: var(--text-s);
		cursor: pointer;
	}
	.chips button:hover {
		background: var(--paper-2);
	}
	.facet {
		color: var(--ink-2);
	}
	.chips .reset {
		border-color: transparent;
		color: var(--ink-2);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	/* Mobile: type and facets one full row each, equally wide fields. */
	/* Mobile: the bar would be too tall to stay in place; it scrolls along. */
	@media (max-width: 640px) {
		.bar {
			position: static;
		}
		.row {
			gap: var(--space-2);
		}
		.facets {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			width: 100%;
		}
		.facets :global(.cg-lib-trigger) {
			height: calc(var(--ctl-m) - var(--space-2));
			justify-content: space-between;
			width: 100%;
			padding: 0 var(--space-2);
		}
		.count {
			margin-left: 0;
		}
	}
</style>
