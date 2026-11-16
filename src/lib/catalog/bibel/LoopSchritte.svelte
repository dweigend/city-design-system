<script lang="ts">
	import { onMount } from 'svelte';
	import { RadioGroup } from 'bits-ui';
	import { Pause, Play } from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import type { Phase } from '../data/raster';

	/**
	 * Steps of an explainer loop: a real sequence, hence with numbers. The running step
	 * shows its sentence and a progress bar; a click jumps to its start.
	 */
	let {
		id,
		label,
		phasen,
		index,
		anteil,
		laeuft,
		onwahl,
		onumschalten
	}: {
		id: string;
		label: string;
		phasen: readonly Phase[];
		index: number;
		anteil: number;
		laeuft: boolean;
		onwahl: (index: number) => void;
		onumschalten: () => void;
	} = $props();

	const value = $derived(phasen[index]?.id ?? '');
	// After hydration, draw fresh once (see play button).
	let montiert = $state(false);
	onMount(() => (montiert = true));
</script>

<div class="loop">
	<div class="kopf">
		<span class="titel" {id}>{label}</span>
		<Button
			variant="icon"
			label={laeuft ? 'Pause' : 'Play'}
			onclick={onumschalten}
			aria-pressed={laeuft}
		>
			<!-- Rebuild instead of remodel: server and client can start differently (reduced
			     motion); during hydration lucide would otherwise mix the shapes of both symbols. -->
			{#snippet icon()}{#key `${montiert}${laeuft}`}<Icon
						icon={laeuft ? Pause : Play}
						size={16}
					/>{/key}{/snippet}
		</Button>
	</div>
	<RadioGroup.Root
		{value}
		onValueChange={(v) => onwahl(phasen.findIndex((p) => p.id === v))}
		aria-labelledby={id}
		class="schritte"
	>
		{#each phasen as p, i (p.id)}
			<RadioGroup.Item value={p.id} class="schritt">
				<span class="nr">{i + 1}</span>
				<span class="name">{p.titel}</span>
				{#if i === index}
					<span class="text">{p.text}</span>
					<span class="lauf" aria-hidden="true"
						><span class="fill" style:transform="scaleX({anteil})"></span></span
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
	.loop :global(.schritte) {
		display: flex;
		flex-direction: column;
		border-top: var(--hair) solid var(--line);
	}
	.loop :global(.schritt) {
		display: grid;
		grid-template-columns: var(--space-6) 1fr;
		column-gap: var(--space-2);
		row-gap: var(--space-2);
		align-items: baseline;
		width: 100%;
		padding: var(--space-3) 0;
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
	.loop :global(.schritt:hover),
	.loop :global(.schritt[data-state='checked']) {
		color: var(--ink);
	}
	.loop :global(.schritt:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	.nr {
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	.loop :global(.schritt[data-state='checked'] .name) {
		font-weight: 600;
	}
	.text {
		grid-column: 2;
		line-height: 1.5;
		color: var(--ink-2);
	}
	.lauf {
		grid-column: 2;
		display: block;
		height: var(--hair);
		background: var(--line);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--ink);
		transform-origin: left;
	}
	@media (prefers-reduced-motion: reduce) {
		.lauf {
			display: none;
		}
	}
</style>
