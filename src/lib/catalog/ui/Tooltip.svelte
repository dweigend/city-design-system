<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import type { TooltipVariant } from '../data/system';
	// The label uses the value tag (global class .cg-tag from Tag.svelte).
	import './Tag.svelte';

	let {
		variant = 'label',
		text,
		index,
		detail,
		trigger
	}: {
		variant?: TooltipVariant;
		text: string;
		index?: string;
		detail?: string;
		trigger: Snippet<[Record<string, unknown>]>;
	} = $props();
</script>

<Tooltip.Provider delayDuration={80}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}{@render trigger(props)}{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content
				class={variant === 'label' ? 'cg-tooltip cg-tag' : 'cg-tooltip'}
				data-variant={variant}
				side={variant === 'callout' ? 'right' : 'top'}
				sideOffset={variant === 'callout' ? 32 : 8}
			>
				{#if variant === 'label'}
					{text}
				{:else}
					{#if index}<span class="cg-tooltip-index">{index}</span>{/if}
					<strong>{text}</strong>
					{#if detail}<span>{detail}</span>{/if}
				{/if}
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
</Tooltip.Provider>

<style>
	/* Content is portaled into the body, hence global classes with a prefix. Callout spacing 32 px = --space-8. */
	:global(.cg-tooltip) {
		z-index: 50;
	}
	:global(.cg-tooltip[data-variant='callout']) {
		position: relative;
		font-size: var(--text-s);
		display: grid;
		gap: var(--space-1);
		background: var(--paper);
		padding: var(--space-1) 0 var(--space-1) var(--space-3);
		border-left: var(--stroke) solid var(--ink);
	}
	:global(.cg-tooltip[data-variant='callout'])::before {
		content: '';
		position: absolute;
		left: calc(-1 * (var(--space-8) + var(--stroke)));
		top: 50%;
		width: var(--space-8);
		border-top: var(--hair) dashed var(--ink);
	}
	:global(.cg-tooltip[data-variant='callout'] strong) {
		font-weight: 600;
		text-transform: uppercase;
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
	}
	:global(.cg-tooltip-index) {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
</style>
