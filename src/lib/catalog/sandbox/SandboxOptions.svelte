<script lang="ts" generics="Id extends string">
	import { activateChoice } from './hud-commands';
	import { keyboard } from '../ui/keyboard.svelte';
	import { ToggleGroup } from 'bits-ui';
	import type { Box } from 'lucide-svelte';
	import Icon from '../ui/Icon.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	type Option = {
		id: Id;
		name: string;
		shortName?: string;
		color?: string;
		figure?: string;
		shortcut?: string;
		icon?: typeof Box;
	};

	/** Options of the active tool: swatch, name and the figure that carries the meaning. */
	let {
		label,
		options,
		value,
		horizontal = false,
		compact = false,
		onpick
	}: {
		label: string;
		options: readonly Option[];
		horizontal?: boolean;
		compact?: boolean;
		value: string;
		/** Called with the activated item. */
		onpick: (entry: Option) => void;
	} = $props();
</script>

{#snippet option(entry: Option, index: number, props: Record<string, unknown> = {})}
	<ToggleGroup.Item
		{...props}
		value={entry.id}
		{...activateChoice(() => onpick(entry))}
		class="cg-sandbox-option"
		aria-label={entry.name}
		aria-keyshortcuts={keyboard.observed ? (entry.shortcut ?? String(index + 1)) : undefined}
	>
		{#if entry.color}<span class="swatch" style:--swatch={entry.color}></span>{/if}
		<span class="name">{horizontal ? (entry.shortName ?? entry.name) : entry.name}</span>
		{#if keyboard.observed && entry.shortcut}<kbd>{entry.shortcut}</kbd>{/if}
		{#if entry.icon}
			<span class="method-icon"><Icon icon={entry.icon} size={16} /></span>
		{/if}
	</ToggleGroup.Item>
{/snippet}

<ToggleGroup.Root
	type="single"
	orientation={horizontal ? 'horizontal' : 'vertical'}
	{value}
	class="cg-sandbox-options"
	data-compact={compact || undefined}
	aria-label={label}
>
	{#each options as entry, index (entry.id)}
		<Tooltip text={entry.figure ?? entry.name}>
			{#snippet trigger(props)}
				{@render option(entry, index, props)}
			{/snippet}
		</Tooltip>
	{/each}
</ToggleGroup.Root>

<style>
	:global(.cg-sandbox-options) {
		display: grid;
		border: var(--hair) solid var(--ink);
		background: var(--paper);
	}
	:global(.cg-sandbox-option) {
		display: grid;
		grid-template-columns: var(--space-4) auto;
		grid-template-areas: 'swatch name';
		position: relative;
		column-gap: var(--space-3);
		align-items: center;
		min-width: var(--sandbox-target);
		min-height: var(--sandbox-target);
		padding: var(--space-1) var(--space-3);
		border: 0;
		background: none;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	:global(.cg-sandbox-option + .cg-sandbox-option) {
		border-top: var(--hair) solid var(--line);
	}
	:global(.cg-sandbox-option:hover) {
		background: var(--paper-2);
	}
	:global(.cg-sandbox-option[data-state='on'])::after {
		content: '';
		position: absolute;
		inset: auto var(--space-1) 0;
		border-bottom: var(--stroke) solid var(--signal);
		pointer-events: none;
	}
	.swatch {
		grid-area: swatch;
		width: var(--space-4);
		height: var(--space-4);
		border: var(--hair) solid var(--ink);
		border-radius: 50%;
		background: var(--swatch);
	}
	.name {
		grid-area: name;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	:global(.cg-sandbox-options[data-compact]) {
		justify-self: stretch;
	}
	:global(.cg-sandbox-options[data-compact] .cg-sandbox-option) {
		grid-template-columns: auto auto;
		grid-template-areas: 'name key';
		column-gap: var(--space-2);
	}

	kbd {
		grid-area: key;
		font: inherit;
		font-size: var(--text-xs);
		opacity: 0.7;
	}
	.method-icon {
		display: none;
		grid-area: symbol;
	}
	/* Narrow screens: one row of swatches with their names. */
	@media (max-width: 640px) {
		:global(.cg-sandbox-options) {
			grid-auto-flow: column;
			grid-auto-columns: minmax(var(--ctl-m), auto);
		}
		:global(.cg-sandbox-option) {
			grid-template-columns: auto;
			grid-template-areas: 'swatch' 'name';
			justify-items: center;
			padding: var(--space-2) calc(var(--space-1) / 2);
		}
		:global(.cg-sandbox-option + .cg-sandbox-option) {
			border-top: 0;
			border-left: var(--hair) solid var(--line);
		}
		:global(.cg-sandbox-options[data-compact] .cg-sandbox-option) {
			grid-template-columns: auto;
			grid-template-areas: 'symbol' 'name';
			min-width: var(--sandbox-target);
		}
		.name {
			letter-spacing: 0;
		}
		kbd {
			display: none;
		}
		.method-icon {
			display: inline-flex;
		}
	}
</style>
