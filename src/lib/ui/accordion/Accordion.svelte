<script lang="ts">
	import { defaults } from '../../../config/accordion';
	import { Accordion as Primitive } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { Icon } from '../icon';

	interface Props {
		/** Rows in order, such as [{ value: 'survey', label: 'Survey notes' }]. */
		items: readonly { value: string; label: string; disabled?: boolean }[];
		/** Bind the open row ID, or use "" to close all rows. */
		value?: string;
		/** Render details by row ID, for example {#snippet panel(row)}. */
		panel: Snippet<[string]>;
	}

	let { items, value = $bindable(''), panel }: Props = $props();
</script>

<Primitive.Root class="control-accordion" type="single" bind:value>
	{#each items as item (item.value)}
		<Primitive.Item value={item.value} disabled={item.disabled}>
			<Primitive.Header class="control-accordion-heading" level={defaults.accordionHeadingLevel}>
				<Primitive.Trigger class="control control-accordion-trigger">
					{item.label}
					<Icon name="chevron-down" />
				</Primitive.Trigger>
			</Primitive.Header>
			<Primitive.Content class="control-accordion-panel">
				{@render panel(item.value)}
			</Primitive.Content>
		</Primitive.Item>
	{/each}
</Primitive.Root>
