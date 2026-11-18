<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import type { SandboxOption } from '../data/sandbox';

	/** Options of the active tool: swatch, name and the figure that carries the meaning. */
	let {
		label,
		options,
		value,
		onpick
	}: {
		label: string;
		options: SandboxOption<string>[];
		value: string;
		/** Called with the 0-based index of the picked option. */
		onpick: (index: number) => void;
	} = $props();
</script>

<ToggleGroup.Root
	type="single"
	orientation="vertical"
	{value}
	onValueChange={(next) => next && onpick(options.findIndex((o) => o.id === next))}
	class="cg-sandbox-options"
	aria-label={label}
>
	{#each options as entry, index (entry.id)}
		<ToggleGroup.Item
			value={entry.id}
			class="cg-sandbox-option"
			aria-keyshortcuts={String(index + 1)}
		>
			<span class="swatch" style:--swatch={entry.color}></span>
			<span class="name">{entry.name}</span>
			<span class="figure">{entry.figure}</span>
		</ToggleGroup.Item>
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
		grid-template-areas: 'swatch name' 'swatch figure';
		column-gap: var(--space-3);
		align-items: center;
		min-height: var(--ctl-m);
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
	:global(.cg-sandbox-option[data-state='on']) {
		background: var(--ink);
		color: var(--paper);
	}
	.swatch {
		grid-area: swatch;
		width: var(--space-4);
		height: var(--space-4);
		border: var(--hair) solid var(--ink);
		border-radius: 50%;
		background: var(--swatch);
	}
	:global(.cg-sandbox-option[data-state='on']) .swatch {
		border-color: var(--paper);
	}
	.name {
		grid-area: name;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.figure {
		grid-area: figure;
		font-size: var(--text-xs);
		opacity: 0.7;
	}
	/* Narrow screens: one row of swatches with their names. */
	@media (max-width: 640px) {
		:global(.cg-sandbox-options) {
			grid-auto-flow: column;
			grid-auto-columns: 1fr;
		}
		:global(.cg-sandbox-option) {
			grid-template-columns: auto;
			grid-template-areas: 'swatch' 'name';
			justify-items: center;
			padding: var(--space-2) var(--space-1);
		}
		:global(.cg-sandbox-option + .cg-sandbox-option) {
			border-top: 0;
			border-left: var(--hair) solid var(--line);
		}
		.figure {
			display: none;
		}
	}
</style>
