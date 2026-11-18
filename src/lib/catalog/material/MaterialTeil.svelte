<script lang="ts">
	/**
	 * Divider between two parts of the Material chapter. Not a section: it carries an anchor,
	 * a short name and one sentence, so the reader sees where the teaching part begins.
	 */
	let { id, titel, lead }: { id: string; titel: string; lead: string } = $props();
</script>

<div class="teil" {id}>
	<p class="titel">{titel}</p>
	<p class="lead">{lead}</p>
</div>

<style>
	.teil {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		gap: var(--space-2) var(--space-8);
		padding: var(--space-4) 0 var(--space-12);
		border-top: var(--stroke) solid var(--ink);
	}
	.titel {
		font-size: var(--text-l);
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}
	.lead {
		max-width: 56ch;
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	@media (max-width: 960px) {
		.teil {
			grid-template-columns: 1fr;
			padding-bottom: var(--space-8);
		}
	}
</style>
