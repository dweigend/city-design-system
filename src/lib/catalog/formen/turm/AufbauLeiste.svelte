<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { Pause, Play } from 'lucide-svelte';
	import Button from '../../ui/Button.svelte';
	import Icon from '../../ui/Icon.svelte';

	/**
	 * Build-up below the image: play and the phases as progress. Built phases carry an
	 * ink line, the current one is bold. A click jumps into the phase.
	 */
	let {
		phasen,
		value = $bindable(''),
		spielt = false,
		onspielen
	}: {
		phasen: { id: string; label: string }[];
		value?: string;
		spielt?: boolean;
		onspielen: () => void;
	} = $props();
	const index = $derived(phasen.findIndex((p) => p.id === value));
</script>

<div class="aufbau">
	<Button variant="icon" label={spielt ? 'Pause build-up' : 'Play build-up'} onclick={onspielen}>
		{#snippet icon()}<Icon icon={spielt ? Pause : Play} size={16} />{/snippet}
	</Button>
	<ToggleGroup.Root
		type="single"
		{value}
		onValueChange={(v) => {
			if (v) value = v;
		}}
		class="cg-phasen"
		aria-label="Construction phase"
	>
		{#each phasen as p, i (p.id)}
			<ToggleGroup.Item value={p.id} class="cg-phase" data-gebaut={i <= index ? '' : undefined}
				>{p.label}</ToggleGroup.Item
			>
		{/each}
	</ToggleGroup.Root>
</div>

<style>
	.aufbau {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	:global(.cg-phasen) {
		flex: 1;
		display: flex;
		gap: var(--space-1);
		min-width: 0;
	}
	:global(.cg-phase) {
		flex: 1;
		min-width: 0;
		height: var(--ctl-m);
		padding: 0;
		border: 0;
		border-top: var(--stroke) solid var(--line);
		background: none;
		color: var(--ink-3);
		font-size: var(--text-s);
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition:
			color var(--fast) var(--ease),
			border-color var(--fast) var(--ease);
	}
	:global(.cg-phase[data-gebaut]) {
		border-top-color: var(--ink);
		color: var(--ink-2);
	}
	:global(.cg-phase[data-state='on']) {
		color: var(--ink);
		font-weight: 600;
	}
	:global(.cg-phase:hover) {
		color: var(--ink);
	}
	:global(.cg-phase:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	@media (max-width: 640px) {
		:global(.cg-phase) {
			height: 44px;
			font-size: var(--text-xs);
		}
	}
</style>
