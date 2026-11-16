<script lang="ts">
	import { Button } from 'bits-ui';
	import { flowToken } from '../data/focus';
	import type { Eingriff } from '../data/stadtBausteine';

	/**
	 * What a step does in this situation: color, name, one sentence. Pointing or tapping highlights the
	 * intervention in the image (hover is shared with the stage). Gray stands for existing stock.
	 */
	let { items, hover = $bindable<string | undefined>() }: { items: Eingriff[]; hover?: string } =
		$props();
</script>

<ul class="eingriffe">
	{#each items as item (item.target)}
		<li>
			<Button.Root
				class="eingriff"
				data-aktiv={hover === item.target ? '' : undefined}
				aria-pressed={hover === item.target}
				onmouseenter={() => (hover = item.target)}
				onmouseleave={() => (hover = undefined)}
				onfocus={() => (hover = item.target)}
				onblur={() => (hover = undefined)}
				onclick={() => (hover = hover === item.target ? undefined : item.target)}
			>
				<span
					class="ton"
					class:bestand={!item.strom}
					style:background={item.strom ? `var(${flowToken[item.strom]})` : undefined}
				></span>
				<span class="titel">{item.titel}</span>
				<span class="text">{item.text}</span>
			</Button.Root>
		</li>
	{/each}
</ul>

<style>
	.eingriffe {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: var(--hair) solid var(--line);
	}
	.eingriffe :global(.eingriff) {
		display: grid;
		grid-template-columns: var(--space-3) 1fr;
		column-gap: var(--space-3);
		row-gap: var(--space-1);
		width: 100%;
		padding: var(--space-3) 0;
		border: 0;
		border-bottom: var(--hair) solid var(--line);
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: var(--text-s);
		text-align: left;
		cursor: pointer;
	}
	.eingriffe :global(.eingriff[data-aktiv] .titel) {
		text-decoration: underline;
		text-decoration-color: var(--signal);
		text-decoration-thickness: var(--stroke);
		text-underline-offset: var(--space-1);
	}
	.ton {
		width: var(--space-3);
		height: var(--space-3);
		margin-top: 3px;
		border: var(--hair) solid var(--ink);
	}
	.ton.bestand {
		background: var(--paper-3);
		border-color: var(--ink-3);
	}
	.titel {
		font-weight: 600;
	}
	.text {
		grid-column: 2;
		line-height: 1.45;
		color: var(--ink-2);
	}
</style>
