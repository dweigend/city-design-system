<script lang="ts">
	import { Toggle } from 'bits-ui';
	import Icon from '../ui/Icon.svelte';
	import { flows, flowToken, MAX_FOKUS_STROEME, type FlowId } from '../data/focus';
	import { stromIcons } from '../data/icons';

	/**
	 * Choose flows yourself: five switches, symbol in flow color plus name, never color alone.
	 * At most three at once; what a fourth displaces is decided by `onwaehle` (logic/farbe).
	 */
	let {
		label = 'Flows in focus',
		value,
		onwaehle
	}: { label?: string; value: FlowId[]; onwaehle: (strom: FlowId) => void } = $props();
</script>

<div class="wahl" role="group" aria-label="{label}, at most {MAX_FOKUS_STROEME}">
	<span class="titel" aria-hidden="true">{label}</span>
	<div class="liste">
		{#each flows as f (f.id)}
			<Toggle.Root
				class="cg-strom"
				pressed={value.includes(f.id)}
				onPressedChange={() => onwaehle(f.id)}
			>
				<Icon icon={stromIcons[f.id]} size={16} ton={flowToken[f.id]} />
				<span>{f.name}</span>
			</Toggle.Root>
		{/each}
	</div>
	<p>At most three at once. A fourth displaces the first.</p>
</div>

<style>
	.wahl {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.titel,
	p {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.liste {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.wahl :global(.cg-strom) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 36px;
		padding: 0 var(--space-3);
		border: 0;
		background: none;
		box-shadow: inset 0 0 0 var(--hair) var(--line);
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-s);
		cursor: pointer;
		touch-action: manipulation;
	}
	.wahl :global(.cg-strom:hover) {
		color: var(--ink);
	}
	.wahl :global(.cg-strom:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 1px;
	}
	.wahl :global(.cg-strom[data-state='on']) {
		color: var(--ink);
		font-weight: 600;
		background: var(--paper-2);
		box-shadow: inset 0 0 0 var(--stroke) var(--ink);
	}
	@media (max-width: 960px) {
		.wahl :global(.cg-strom) {
			min-height: 44px;
		}
	}
</style>
