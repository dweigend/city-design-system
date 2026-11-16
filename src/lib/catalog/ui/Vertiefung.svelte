<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { ChevronRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * Deep dive: details one click below the main level (values, derivation, further sliders).
	 * The trigger says what is inside, never just “More”.
	 */
	let {
		label,
		open = $bindable(false),
		children
	}: { label: string; open?: boolean; children: Snippet } = $props();
</script>

<Collapsible.Root bind:open class="vertiefung">
	<Collapsible.Trigger class="ausloeser">
		<span class="pfeil"><Icon icon={ChevronRight} size={16} /></span>{label}
	</Collapsible.Trigger>
	<Collapsible.Content class="inhalt">{@render children()}</Collapsible.Content>
</Collapsible.Root>

<style>
	:global(.vertiefung) {
		border-top: var(--hair) solid var(--line);
	}
	:global(.vertiefung) :global(.ausloeser) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--u10);
		padding: 0;
		border: 0;
		background: none;
		font-size: var(--text-s);
		text-align: left;
		cursor: pointer;
	}
	:global(.vertiefung) :global(.ausloeser:hover) {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.pfeil {
		display: inline-flex;
		color: var(--ink-2);
		transition: transform var(--fast) var(--ease);
	}
	:global(.vertiefung[data-state='open']) .pfeil {
		transform: rotate(90deg);
	}
	:global(.vertiefung) :global(.inhalt) {
		padding: var(--space-2) 0 var(--space-6) var(--space-6);
	}
	@media (max-width: 960px) {
		:global(.vertiefung) :global(.ausloeser) {
			min-height: 44px;
		}
	}
</style>
