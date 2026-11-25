<script lang="ts">
	import { defaults } from '../../../config/tabs';
	import { Tabs as Primitive } from 'bits-ui';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Name the tab list, for example "Drawing sections". */
		label: string;
		/** Sections in order, such as [{ value: 'plan', label: 'Plan' }]. */
		items: readonly { value: string; label: string; disabled?: boolean }[];
		/** Bind the active section ID, for example bind:value={section}. */
		value: string;
		/** Render a section by ID, for example {#snippet panel(section)}. */
		panel: Snippet<[string]>;
	}

	let { label, items, value = $bindable(), panel }: Props = $props();
</script>

<Primitive.Root class="control-tabs" bind:value>
	<Primitive.List class="control-tabs-list" aria-label={label}>
		{#each items as item, index (item.value)}
			<Primitive.Trigger class="control control-tab" value={item.value} disabled={item.disabled}>
				<span class="data" aria-hidden="true"
					>{String(index + 1).padStart(defaults.tabNumberDigits, '0')}</span
				>
				{item.label}
			</Primitive.Trigger>
		{/each}
	</Primitive.List>
	{#each items as item (item.value)}
		<Primitive.Content class="control-tab-panel" value={item.value}>
			{@render panel(item.value)}
		</Primitive.Content>
	{/each}
</Primitive.Root>
