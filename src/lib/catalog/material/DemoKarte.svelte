<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Card of one layer demo below the picker: a short heading, the demo, one caption line.
	 * `breit` spans both columns of the demo grid. The id is the section's public anchor.
	 */
	let {
		id,
		titel,
		text,
		breit = false,
		children
	}: { id: string; titel: string; text?: string; breit?: boolean; children: Snippet } = $props();
</script>

<section {id} class="karte" class:breit aria-labelledby="{id}-titel">
	<h2 id="{id}-titel">{titel}</h2>
	{@render children()}
	{#if text}<p class="text">{text}</p>{/if}
</section>

<style>
	.karte {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-width: 0;
		padding-top: var(--space-4);
		border-top: var(--hair) solid var(--ink);
	}
	.breit {
		grid-column: 1 / -1;
	}
	h2 {
		font-size: var(--text-m);
		font-weight: 600;
		line-height: 1.2;
	}
	.text {
		max-width: 62ch;
		font-size: var(--text-xs);
		line-height: 1.45;
		color: var(--ink-2);
	}
</style>
