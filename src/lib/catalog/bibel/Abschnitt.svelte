<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Section of a Bible page: heading as a statement, one paragraph, then the content.
	 * Page grid (114 §3): one left alignment line for everything. Content splits into
	 * image on the left (8 of 12 columns) and word or slider on the right (4 of 12).
	 */
	let {
		id,
		titel,
		lead,
		children
	}: { id: string; titel: string; lead?: string; children: Snippet } = $props();
</script>

<section {id} aria-labelledby="{id}-titel">
	<header>
		<h2 id="{id}-titel">{titel}</h2>
		{#if lead}<p>{lead}</p>{/if}
	</header>
	{@render children()}
</section>

<style>
	section {
		border-top: var(--hair) solid var(--ink);
		padding: var(--space-6) 0 var(--space-20);
	}
	header {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-10);
	}
	h2 {
		font-size: var(--text-l);
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}
	p {
		max-width: 68ch;
		line-height: 1.5;
	}
	@media (max-width: 960px) {
		header {
			margin-bottom: var(--space-6);
		}
	}
</style>
