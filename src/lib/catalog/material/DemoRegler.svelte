<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One row of local controls directly below a compact layer demo. It sets the control voice of
	 * bibel/DemoLayout so ChoiceControl and Scale read the same here; it holds no state.
	 */
	let { label, children }: { label: string; children: Snippet } = $props();
</script>

<div class="regler" role="group" aria-label={label}>{@render children()}</div>

<style>
	.regler {
		--steuer-schrift: var(--font-sans);
		--steuer-groesse: var(--text-s);
		--steuer-versal: none;
		--steuer-sperrung: 0;
		--steuer-luft: var(--space-1);
		--steuer-knopf: calc(var(--ctl-m) - var(--space-2));
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: var(--space-2) var(--space-6);
		min-width: 0;
	}
	.regler > :global(*) {
		flex: 1 1 14rem;
		min-width: 0;
	}
</style>
