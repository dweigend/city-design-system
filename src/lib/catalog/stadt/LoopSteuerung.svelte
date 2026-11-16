<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { Pause, Play } from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import type { LoopPhase } from '../data/stadtBausteine';

	/**
	 * Steps of an explainer loop as a sequence: the running step shows its sentence and a
	 * progress bar; a click jumps to its start. Play and pause beside it.
	 * The steps really are a sequence, hence the numbers.
	 */
	let {
		id,
		label,
		phasen,
		index,
		local,
		running,
		onselect,
		ontoggle
	}: {
		id: string;
		label: string;
		phasen: readonly LoopPhase[];
		index: number;
		local: number;
		running: boolean;
		onselect: (index: number) => void;
		ontoggle: () => void;
	} = $props();

	const value = $derived(phasen[index]?.id ?? '');
</script>

<div class="loop">
	<div class="kopf">
		<span class="titel" {id}>{label}</span>
		<Button
			variant="icon"
			label={running ? 'Pause' : 'Play'}
			onclick={ontoggle}
			aria-pressed={running}
		>
			{#snippet icon()}<Icon icon={running ? Pause : Play} size={16} />{/snippet}
		</Button>
	</div>
	<RadioGroup.Root
		{value}
		onValueChange={(v) => onselect(phasen.findIndex((p) => p.id === v))}
		aria-labelledby={id}
		class="schritte"
	>
		{#each phasen as p, i (p.id)}
			<RadioGroup.Item value={p.id} class="schritt" onclick={() => onselect(i)}>
				<span class="nr">{i + 1}</span>
				<span class="name">{p.titel}</span>
				{#if i === index}
					<span class="text">{p.text}</span>
					<span class="lauf" aria-hidden="true"
						><span class="fill" style:width="{Math.round(local * 100)}%"></span></span
					>
				{/if}
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
</div>

<style>
	.loop {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}
	.titel {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.kopf :global(.cg-button) {
		--h: var(--space-8);
	}
	.loop :global(.schritte) {
		display: flex;
		flex-direction: column;
		border-top: var(--hair) solid var(--line);
	}
	.loop :global(.schritt) {
		display: grid;
		grid-template-columns: var(--space-6) 1fr;
		column-gap: var(--space-2);
		align-items: baseline;
		padding: var(--space-2) 0;
		border: 0;
		border-bottom: var(--hair) solid var(--line);
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-s);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.loop :global(.schritt:hover) {
		color: var(--ink);
	}
	.loop :global(.schritt[data-state='checked']) {
		color: var(--ink);
	}
	.nr {
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	.loop :global(.schritt[data-state='checked'] .nr) {
		color: var(--ink);
	}
	.loop :global(.schritt[data-state='checked'] .name) {
		font-weight: 600;
	}
	.text {
		grid-column: 2;
		padding-top: var(--space-1);
		line-height: 1.45;
		color: var(--ink-2);
	}
	.lauf {
		grid-column: 2;
		height: var(--hair);
		margin-top: var(--space-2);
		background: var(--line);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--ink);
	}
</style>
