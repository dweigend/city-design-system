<script lang="ts">
	import type { TagVariant } from '../data/system';
	/** Status: inverse mono label, color via color/onColor. Category: dot in category color. */
	let {
		variant = 'status',
		text,
		meta,
		color,
		onColor
	}: {
		variant?: TagVariant;
		text: string;
		meta?: string | number;
		color?: string;
		onColor?: string;
	} = $props();
</script>

{#if variant === 'status'}
	<span class="cg-tag" style:--tag-bg={color} style:--tag-fg={onColor}
		>{text}{#if meta !== undefined}<span class="meta">{meta}</span>{/if}</span
	>
{:else}
	<span class="category" style:--dot={color}
		><span class="dot" aria-hidden="true"></span>{text}{#if meta !== undefined}<sup>({meta})</sup
			>{/if}</span
	>
{/if}

<style>
	/*
	 * Value tag: global class, so Bits elements (tooltip content, slider thumb)
	 * and HUD chips carry the same look directly. Colors via --tag-bg, --tag-fg, --tag-line.
	 */
	:global(.cg-tag) {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		height: var(--tag-h, var(--ctl-s));
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--tag-line, transparent);
		background: var(--tag-bg, var(--ink));
		color: var(--tag-fg, var(--paper));
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.meta {
		color: var(--tag-fg, var(--paper));
	}
	.category {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-2);
		white-space: nowrap;
		font-size: var(--text-s);
	}
	.dot {
		width: var(--space-3);
		height: var(--space-3);
		border-radius: 50%;
		background: var(--dot);
		align-self: center;
	}
	sup {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--ink-2);
	}
</style>
