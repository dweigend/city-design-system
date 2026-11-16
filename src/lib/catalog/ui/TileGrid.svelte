<script lang="ts">
	import type { Snippet } from 'svelte';
	import Paper from '../foundations/Paper.svelte';
	/** Tiles on the field grid: width in fields, tiles flow without gaps. */
	let { columns = 12, children }: { columns?: number; children: Snippet } = $props();
</script>

<div class="wrap">
	<Paper levels={1}>
		<div class="tile-grid" style:--cols={columns}>{@render children()}</div>
	</Paper>
</div>

<style>
	/* Flex container, so the paper only grows as wide as the grid. */
	.wrap {
		display: flex;
		max-width: 100%;
		overflow-x: auto;
	}
	/* n fields wide plus 1 px for the closing line. dense fills gaps. */
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), var(--u10));
		grid-auto-rows: var(--u10);
		grid-auto-flow: row dense;
		width: calc(var(--cols) * var(--u10) + var(--hair));
		padding-bottom: var(--hair);
	}
</style>
