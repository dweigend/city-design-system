<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { herkunftLabels, type ArchivItem, type Herkunft } from '../data/archiv';
	import { herkunftCount, type ArchivFilter } from './filter';
	import { verfuegbareHerkunft } from '../logic/archiv';

	/** Provenance of the image: all or one collection; counts under the other filters. */
	let { items, filter = $bindable() }: { items: ArchivItem[]; filter: ArchivFilter } = $props();
	const quellen = $derived(verfuegbareHerkunft(items));
</script>

<ToggleGroup.Root
	type="single"
	value={filter.herkunft ?? 'alle'}
	onValueChange={(v) =>
		(filter = { ...filter, herkunft: v && v !== 'alle' ? (v as Herkunft) : null })}
	class="cg-archiv-herkunft"
	aria-label="Provenance"
>
	<ToggleGroup.Item value="alle" class="cg-archiv-quelle"
		>All <span>{herkunftCount(items, filter, null)}</span></ToggleGroup.Item
	>
	{#each quellen as h (h)}
		<ToggleGroup.Item value={h} class="cg-archiv-quelle"
			>{herkunftLabels[h]} <span>{herkunftCount(items, filter, h)}</span></ToggleGroup.Item
		>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.cg-archiv-herkunft) {
		display: inline-flex;
		flex-wrap: wrap;
		border: var(--hair) solid var(--line);
	}
	:global(.cg-archiv-quelle) {
		height: calc(var(--ctl-m) - 2 * var(--hair));
		padding: 0 var(--space-3);
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-s);
		white-space: nowrap;
		cursor: pointer;
		transition:
			background var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}
	:global(.cg-archiv-quelle span) {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	:global(.cg-archiv-quelle:hover) {
		color: var(--ink);
	}
	:global(.cg-archiv-quelle[data-state='on']) {
		background: var(--ink);
		color: var(--paper);
	}
	:global(.cg-archiv-quelle[data-state='on'] span) {
		color: inherit;
		opacity: 0.6;
	}
	/* Mobile: two columns, “All” across the full width. */
	@media (max-width: 640px) {
		:global(.cg-archiv-herkunft) {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			width: 100%;
		}
		:global(.cg-archiv-quelle) {
			height: calc(var(--ctl-m) - var(--space-2) - 2 * var(--hair));
			padding: 0 var(--space-2);
			text-align: left;
		}
		:global(.cg-archiv-quelle:first-child) {
			grid-column: 1 / -1;
		}
	}
</style>
