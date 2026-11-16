<script lang="ts">
	import { RadioGroup, Label } from 'bits-ui';
	let {
		id,
		label,
		items,
		value = $bindable('')
	}: {
		id: string;
		label: string;
		items: { value: string; label: string }[];
		value?: string;
	} = $props();
</script>

<div class="choice">
	<Label.Root {id}>{label}</Label.Root>
	<RadioGroup.Root bind:value aria-labelledby={id} class="options">
		{#each items as item (item.value)}<RadioGroup.Item value={item.value} class="option"
				>{item.label}</RadioGroup.Item
			>{/each}
	</RadioGroup.Root>
</div>

<style>
	/* Calm: no boxes per option. Selected = ink and underline, otherwise ink 2. */
	/* Type via the control variables (bibel/DemoLayout); without them it stays mono. */
	.choice {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--steuer-schrift, var(--font-mono));
		font-size: var(--steuer-groesse, var(--text-xs));
	}
	/* Sentence case: controls of the Bible are never set in capitals. */
	.choice :global(label) {
		color: var(--ink-2);
	}
	.choice :global(.options) {
		display: flex;
		flex-wrap: wrap;
		column-gap: var(--space-3);
		border-bottom: var(--hair) solid var(--line);
	}
	.choice :global(.option) {
		border: 0;
		border-bottom: var(--stroke) solid transparent;
		margin-bottom: calc(-1 * var(--hair));
		min-height: var(--steuer-knopf, auto);
		padding: var(--steuer-luft, var(--space-2)) 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
		transition:
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}
	.choice :global(.option:hover) {
		color: var(--ink);
	}
	.choice :global(.option[data-state='checked']) {
		color: var(--ink);
		border-bottom-color: var(--ink);
	}
</style>
