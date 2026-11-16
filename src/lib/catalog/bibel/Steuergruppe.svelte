<script lang="ts">
	import { Accordion } from 'bits-ui';
	import { ChevronRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import Icon from '../ui/Icon.svelte';

	/**
	 * A collapsible group of the demo controls (only inside bibel/DemoLayout).
	 * The title says what is inside. Only one group is ever open.
	 */
	let { wert, titel, children }: { wert: string; titel: string; children: Snippet } = $props();
</script>

<Accordion.Item value={wert} class="cg-steuergruppe">
	<Accordion.Header level={3} class="cg-steuergruppe-kopf">
		<Accordion.Trigger class="cg-steuergruppe-ausloeser">
			<span class="pfeil" aria-hidden="true"><Icon icon={ChevronRight} size={16} /></span>{titel}
		</Accordion.Trigger>
	</Accordion.Header>
	<Accordion.Content class="cg-steuergruppe-inhalt">{@render children()}</Accordion.Content>
</Accordion.Item>

<style>
	:global(.cg-steuergruppe) {
		border-top: var(--hair) solid var(--line);
	}
	:global(.cg-steuergruppe-ausloeser) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: calc(var(--ctl-m) - var(--space-2));
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--text-s);
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}
	:global(.cg-steuergruppe-ausloeser:focus-visible) {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
	.pfeil {
		display: inline-flex;
		color: var(--ink-2);
		transition: transform var(--fast) var(--ease);
	}
	:global(.cg-steuergruppe[data-state='open']) .pfeil {
		transform: rotate(90deg);
	}
	:global(.cg-steuergruppe-inhalt[hidden]) {
		display: none;
	}
	:global(.cg-steuergruppe-inhalt) {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-1) 0 var(--space-2);
	}
	@media (max-width: 960px) {
		:global(.cg-steuergruppe-ausloeser) {
			min-height: 44px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pfeil {
			transition: none;
		}
	}
</style>
