<script lang="ts">
	import { Switch, Label } from 'bits-ui';
	import type { SwitchVariant } from '../data/system';

	let {
		variant = 'box',
		id,
		label,
		checked = $bindable(false)
	}: { variant?: SwitchVariant; id: string; label: string; checked?: boolean } = $props();
</script>

<span class="switch" data-variant={variant}>
	<Label.Root for={id} class="label">{label}</Label.Root>
	<Switch.Root {id} bind:checked class="root">
		{#if variant === 'labeled'}
			<span class="opt" class:on={!checked} aria-hidden="true">Off</span><span
				class="opt"
				class:on={checked}
				aria-hidden="true">On</span
			>
		{:else}
			<Switch.Thumb class="thumb" />
		{/if}
	</Switch.Root>
</span>

<style>
	.switch {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-width: var(--u50);
		height: var(--ctl-s);
		font-size: var(--text-s);
	}
	.switch :global(.label) {
		cursor: pointer;
	}
	.switch :global(.root) {
		position: relative;
		display: inline-flex;
		border: var(--hair) solid var(--ink);
		padding: 0;
		cursor: pointer;
		background: var(--paper);
	}

	[data-variant='box'] :global(.root) {
		width: var(--u10);
		height: var(--ctl-s);
		padding: 0;
		align-items: center;
		transition: background var(--fast) var(--ease);
	}
	[data-variant='box'] :global(.root[data-state='checked']) {
		background: var(--ink);
	}
	[data-variant='box'] :global(.thumb) {
		display: block;
		width: calc(var(--ctl-s) - 2px);
		height: calc(var(--ctl-s) - 2px);
		background: var(--paper);
		box-shadow: inset 0 0 0 var(--hair) var(--ink);
		transition:
			transform var(--fast) var(--ease),
			background var(--fast) var(--ease);
	}
	[data-variant='box'] :global(.thumb[data-state='checked']) {
		transform: translateX(var(--u5));
		background: var(--paper);
	}

	[data-variant='labeled'] :global(.root) {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
	}
	.opt {
		line-height: calc(var(--ctl-s) - 2px);
		padding: 0 var(--space-2);
		color: var(--ink-2);
		transition:
			background var(--fast) var(--ease),
			color var(--fast) var(--ease);
	}
	.opt.on {
		background: var(--ink);
		color: var(--paper);
	}
</style>
