<script lang="ts" generics="T extends { id: string; name: string }">
	import { RadioGroup } from 'bits-ui';
	import type { Snippet } from 'svelte';

	/**
	 * Selection as a row of small top views directly above the image (pattern of the Grid page).
	 * A click switches the variant, arrow keys move through the row. The preview is drawn by
	 * the caller; the strip only sets frame, name and selection state.
	 */
	let {
		items,
		label,
		value = $bindable(''),
		vorschau
	}: { items: readonly T[]; label: string; value?: string; vorschau: Snippet<[T]> } = $props();
</script>

<RadioGroup.Root
	bind:value
	aria-label={label}
	orientation="horizontal"
	class="cg-bildleiste"
	style="--n: {items.length}"
>
	{#each items as item (item.id)}
		<RadioGroup.Item value={item.id} class="cg-bildleiste-item" aria-label={item.name}>
			<span class="bild" aria-hidden="true">{@render vorschau(item)}</span>
			<span class="name">{item.name}</span>
		</RadioGroup.Item>
	{/each}
</RadioGroup.Root>

<style>
	:global(.cg-bildleiste) {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 6rem));
		gap: var(--space-2);
	}
	:global(.cg-bildleiste-item) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-xs);
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.bild {
		display: block;
		aspect-ratio: 1;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		overflow: hidden;
		transition: border-color var(--fast) var(--ease);
	}
	.bild :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.cg-bildleiste-item:hover),
	:global(.cg-bildleiste-item[data-state='checked']) {
		color: var(--ink);
	}
	:global(.cg-bildleiste-item[data-state='checked']) .name {
		font-weight: 600;
	}
	:global(.cg-bildleiste-item[data-state='checked']) .bild {
		border-color: var(--ink);
		outline: var(--hair) solid var(--ink);
	}
	:global(.cg-bildleiste-item:focus-visible) {
		outline: none;
	}
	:global(.cg-bildleiste-item:focus-visible) .bild {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	@media (max-width: 720px) {
		:global(.cg-bildleiste) {
			gap: var(--space-1);
		}
		.name {
			display: none;
		}
		:global(.cg-bildleiste-item) {
			min-height: 44px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bild {
			transition: none;
		}
	}
</style>
