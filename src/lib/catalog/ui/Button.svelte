<script lang="ts">
	import { Button } from 'bits-ui';
	import type { Snippet } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { ButtonVariant } from '../data/system';

	type Props = Omit<HTMLButtonAttributes, 'children'> & {
		variant?: ButtonVariant;
		label: string;
		/** Keyboard shortcut, on the right in the button. */
		shortcut?: string;
		icon?: Snippet;
	};
	let { variant = 'primary', label, shortcut, icon, ...rest }: Props = $props();
	const showsShortcuts = new MediaQuery('(any-hover: hover) and (any-pointer: fine)');
</script>

<Button.Root
	{...rest}
	class="cg-button"
	data-variant={variant}
	aria-label={variant === 'icon' || variant === 'bare' ? label : undefined}
	aria-keyshortcuts={showsShortcuts.current ? shortcut : undefined}
>
	{#if (variant === 'icon' || variant === 'bare') && icon}
		{@render icon()}
	{:else}
		<span class="cg-button-label">{label}</span>
		{#if variant === 'text'}<span class="cg-button-arrow" aria-hidden="true">→</span>{/if}
		{#if showsShortcuts.current && shortcut && variant !== 'text'}<kbd class="cg-button-key"
				>{shortcut}</kbd
			>{/if}
	{/if}
</Button.Root>

<style>
	/* Global class, so tooltips and other Bits triggers can use the button directly. */
	:global(.cg-button) {
		--h: var(--steuer-knopf, var(--ctl-m));
		display: inline-flex;
		align-items: center;
		gap: var(--space-4);
		height: var(--h);
		padding: 0 var(--space-3);
		border: var(--hair) solid var(--ink);
		border-radius: 0;
		background: var(--paper);
		color: var(--ink);
		/* Control variables (bibel/DemoLayout) set the buttons of a demo in the text font. */
		font-family: var(--steuer-schrift, var(--font-mono));
		font-size: var(--steuer-groesse, var(--text-xs));
		font-weight: 500;
		text-transform: var(--steuer-versal, uppercase);
		letter-spacing: var(--steuer-sperrung, 0.06em);
		cursor: pointer;
		transition:
			background var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}
	:global(.cg-button-label) {
		flex: 1;
		text-align: left;
	}
	:global(.cg-button-key) {
		font: inherit;
		padding-left: var(--space-3);
		border-left: var(--hair) solid currentColor;
		opacity: 0.6;
		align-self: stretch;
		display: inline-flex;
		align-items: center;
	}

	/* Primary: black block */
	:global(.cg-button[data-variant='primary']) {
		background: var(--ink);
		color: var(--paper);
		min-width: var(--tile-l);
	}
	:global(.cg-button[data-variant='primary']:hover:not(:disabled)) {
		background: var(--paper);
		color: var(--ink);
	}

	/* Secondary: outline */
	:global(.cg-button[data-variant='secondary']) {
		min-width: var(--tile-l);
	}
	:global(.cg-button[data-variant='secondary']:hover:not(:disabled)) {
		background: var(--ink);
		color: var(--paper);
	}

	/* Text: no outline, arrow moves */
	:global(.cg-button[data-variant='text']) {
		border-color: transparent;
		padding: 0;
		gap: var(--space-2);
		background: none;
	}
	:global(.cg-button-arrow) {
		transition: transform var(--fast) var(--ease);
	}
	:global(.cg-button[data-variant='text']:hover:not(:disabled) .cg-button-arrow) {
		transform: translateX(var(--space-1));
	}
	:global(.cg-button[data-variant='text']:hover:not(:disabled) .cg-button-label) {
		text-decoration: underline;
		text-underline-offset: var(--space-1);
	}

	/* Icon: square */
	:global(.cg-button[data-variant='icon']) {
		width: var(--h);
		padding: 0;
		justify-content: center;
	}
	:global(.cg-button[data-variant='icon']:hover:not(:disabled)) {
		background: var(--ink);
		color: var(--paper);
	}

	/* Selected (e.g. tool in a Bits Toolbar that uses this class) */
	:global(.cg-button[data-variant='icon'][data-state='on']) {
		background: var(--ink);
		color: var(--paper);
	}

	/* No own look: trigger for tooltips on graphics */
	:global(.cg-button[data-variant='bare']) {
		height: auto;
		padding: 0;
		border: 0;
		background: none;
		cursor: help;
	}

	/* Disabled: hatching as in a construction drawing */
	:global(.cg-button:disabled) {
		cursor: not-allowed;
		color: var(--ink-3);
		border-color: var(--ink-3);
		background:
			repeating-linear-gradient(
				135deg,
				transparent 0 var(--space-1),
				var(--paper-3) var(--space-1) calc(var(--space-1) + var(--hair))
			),
			var(--paper);
	}
	:global(.cg-button[data-variant='text']:disabled) {
		background: none;
		border-color: transparent;
	}
</style>
