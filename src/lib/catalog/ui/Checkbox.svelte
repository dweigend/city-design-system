<script lang="ts">
	import { Checkbox, Label } from 'bits-ui';
	let {
		id,
		label,
		checked = $bindable(false)
	}: { id: string; label: string; checked?: boolean } = $props();
</script>

<span class="check">
	<Checkbox.Root {id} bind:checked class="root">
		{#snippet children({ checked })}{#if checked}<span class="inner"></span>{/if}{/snippet}
	</Checkbox.Root>
	<Label.Root for={id} class="label">{label}</Label.Root>
</span>

<style>
	.check {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--ctl-s);
		font-size: var(--text-s);
	}
	.check :global(.root) {
		width: var(--space-4);
		height: var(--space-4);
		padding: 0;
		display: grid;
		place-items: center;
		border: var(--hair) solid var(--ink);
		background: var(--paper);
		cursor: pointer;
		flex: none;
	}
	.check :global(.label) {
		cursor: pointer;
	}
	.inner {
		width: var(--space-2);
		height: var(--space-2);
		background: var(--ink);
	}
</style>
