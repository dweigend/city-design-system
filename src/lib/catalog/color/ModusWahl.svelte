<script lang="ts">
	import { RadioGroup, Label } from 'bits-ui';
	import Icon from '../ui/Icon.svelte';
	import { flows, flowToken, focusModes } from '../data/focus';
	import { stromIcons } from '../data/icons';

	/**
	 * Choose a focus mode: name, the player's question and the flows it colors (symbol in
	 * flow color). A mode is an activity, not a flow: it carries no color itself.
	 * An empty value means: flows chosen by yourself.
	 */
	let {
		id = 'modus-wahl',
		label = 'What do you want to know?',
		value = $bindable('')
	}: { id?: string; label?: string; value?: string } = $props();

	const name = (f: string) => flows.find((x) => x.id === f)?.name ?? f;
</script>

<div class="wahl">
	<Label.Root {id}>{label}</Label.Root>
	<RadioGroup.Root bind:value aria-labelledby={id} class="cg-modus-liste">
		{#each focusModes as m (m.id)}
			<RadioGroup.Item
				value={m.id}
				class="cg-modus"
				aria-label="{m.name}: {m.question}{m.flows.length
					? ` Flows: ${m.flows.map(name).join(', ')}`
					: ' No flow color'}"
			>
				<span class="kopf">
					<span class="name">{m.name}</span>
					<span class="zeichen" aria-hidden="true">
						{#each m.flows as f (f)}<Icon
								icon={stromIcons[f]}
								size={16}
								ton={flowToken[f]}
							/>{/each}
					</span>
				</span>
				<span class="frage">{m.question}</span>
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
</div>

<style>
	.wahl {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.wahl :global(label) {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.wahl :global(.cg-modus-liste) {
		display: flex;
		flex-direction: column;
	}
	.wahl :global(.cg-modus) {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
		min-height: 44px;
		padding: var(--space-2) var(--space-3);
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
		transition: color var(--fast) var(--ease);
	}
	.wahl :global(.cg-modus:hover) {
		color: var(--ink);
	}
	.wahl :global(.cg-modus:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	/* Selected: ink, surface and a bar at the alignment line (as in StromWahl). */
	.wahl :global(.cg-modus[data-state='checked']) {
		color: var(--ink);
		background: var(--paper-2);
		box-shadow: inset var(--stroke) 0 0 var(--ink);
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.name {
		font-size: var(--text-s);
		font-weight: 600;
	}
	.zeichen {
		display: inline-flex;
		gap: var(--space-1);
	}
	.frage {
		font-size: var(--text-xs);
		line-height: 1.35;
	}
	@media (max-width: 960px) {
		.wahl :global(.cg-modus-liste) {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: var(--space-1);
		}
		.wahl :global(.cg-modus) {
			box-shadow: inset 0 0 0 var(--hair) var(--line);
		}
		.wahl :global(.cg-modus[data-state='checked']) {
			box-shadow: inset 0 0 0 var(--hair) var(--ink);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.wahl :global(.cg-modus) {
			transition: none;
		}
	}
</style>
