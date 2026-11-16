<script lang="ts">
	import { Label } from 'bits-ui';
	import Button from '../ui/Button.svelte';
	import { nextSeed } from '../logic/parametrik/random';

	/** Seed and “Reroll” in one row (rule of the demo controls, bibel/DemoLayout). */
	let { value = $bindable(42), id }: { value?: number; id: string } = $props();
</script>

<div class="saat">
	<Label.Root for={id}>Seed</Label.Root>
	<input
		{id}
		name={id}
		autocomplete="off"
		inputmode="numeric"
		type="number"
		min="0"
		max="4294967295"
		step="1"
		{value}
		oninput={(event) => {
			const n = event.currentTarget.valueAsNumber;
			value = Number.isFinite(n) ? Math.max(0, Math.min(4294967295, Math.round(n))) : value;
		}}
	/>
	<Button variant="secondary" label="Reroll" onclick={() => (value = nextSeed(value))} />
</div>

<style>
	.saat {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-s);
	}
	.saat :global(label) {
		color: var(--ink-2);
	}
	input {
		width: 100%;
		min-width: 0;
		height: var(--steuer-knopf, var(--ctl-m));
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		padding: 0 var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	input:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -1px;
	}
	.saat :global(.cg-button[data-variant='secondary']) {
		min-width: 0;
	}
</style>
