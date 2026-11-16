<script lang="ts">
	/** One sentence below the image: what is currently visible, optionally with a bold name in front. */
	let { name, text }: { name?: string; text: string } = $props();
</script>

<p aria-live="polite">
	{#if name}<strong>{name}.</strong> {text}{:else}{text}{/if}
</p>

<style>
	p {
		min-height: calc(2 * 1.5em);
		max-width: 62ch;
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	strong {
		color: var(--ink);
		font-weight: 600;
	}
</style>
