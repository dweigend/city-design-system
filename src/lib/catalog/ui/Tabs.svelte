<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { untrack, type Snippet } from 'svelte';
	import type { TabsVariant } from '../data/system';

	/** One Tabs component for the catalog and the overview page. Content optional as a snippet. */
	type Item = { id: string; index?: string; label: string; content?: Snippet };
	let {
		variant = 'index',
		items,
		label = 'Sections',
		value = $bindable(untrack(() => items[0]?.id ?? ''))
	}: { variant?: TabsVariant; items: Item[]; label?: string; value?: string } = $props();
</script>

<div class="tabs" data-variant={variant}>
	<Tabs.Root bind:value>
		<Tabs.List class="list" aria-label={label}>
			{#each items as item (item.id)}
				<Tabs.Trigger value={item.id} class="trigger">
					{#if variant === 'index' && item.index}<span class="index">{item.index}</span
						>{/if}{item.label}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
		{#each items as item (item.id)}
			{#if item.content}
				<Tabs.Content value={item.id} class="content" tabindex={-1}
					>{@render item.content()}</Tabs.Content
				>
			{/if}
		{/each}
	</Tabs.Root>
</div>

<style>
	.tabs :global(.list) {
		display: flex;
	}
	.tabs :global(.trigger) {
		background: none;
		border: 0;
		cursor: pointer;
		font-size: var(--text-s);
		color: var(--ink-2);
		padding: 0;
		transition:
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}
	.tabs :global(.trigger:hover),
	.tabs :global(.trigger[data-state='active']) {
		color: var(--ink);
	}
	.tabs :global(.content:focus) {
		outline: none;
	}
	.index {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}

	/* Index: line on top, always 2 px, only the color changes (no offset) */
	[data-variant='index'] :global(.list) {
		gap: var(--space-2);
	}
	[data-variant='index'] :global(.content) {
		padding-top: var(--space-5);
	}
	[data-variant='index'] :global(.trigger) {
		flex: 1;
		display: flex;
		gap: var(--space-2);
		align-items: center;
		max-width: var(--u50);
		height: var(--ctl-m);
		text-align: left;
		border-top: var(--stroke) solid var(--line);
	}
	[data-variant='index'] :global(.trigger[data-state='active']) {
		border-top-color: var(--ink);
	}

	/* Underline: compact */
	[data-variant='underline'] :global(.list) {
		gap: var(--space-6);
		border-bottom: var(--hair) solid var(--line);
	}
	[data-variant='underline'] :global(.content) {
		padding-top: var(--space-5);
	}
	[data-variant='underline'] :global(.trigger) {
		height: var(--ctl-m);
		margin-bottom: calc(-1 * var(--hair));
		border-bottom: var(--stroke) solid transparent;
		text-transform: var(--steuer-versal, uppercase);
		font-size: var(--steuer-groesse, var(--text-xs));
		letter-spacing: var(--steuer-sperrung, 0.04em);
		font-weight: 500;
		color: var(--ink-2);
	}
	[data-variant='underline'] :global(.trigger[data-state='active']) {
		border-bottom-color: var(--ink);
	}
</style>
