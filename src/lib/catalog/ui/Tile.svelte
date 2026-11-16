<script lang="ts">
	/** Color tile. Size in fields: S = 1, M = 2 × 2, L = 3 × 3. Sits in a TileGrid. */
	let {
		size = 'm',
		index,
		category,
		value,
		text,
		color
	}: {
		size?: 's' | 'm' | 'l';
		index: string;
		category: string;
		value?: string;
		text?: string;
		color: string;
	} = $props();
</script>

<article
	class="tile"
	data-size={size}
	style:--cat={color}
	aria-label="{category} {value ?? ''} {text ?? ''}"
>
	{#if size === 's'}
		<span class="idx">{index}</span>
	{:else}
		<div class="head">
			<h3>{category}</h3>
			{#if size === 'l'}<span class="idx">{index}</span>{/if}
		</div>
		{#if value}<p class="value">{value}</p>{/if}
		{#if text && size === 'l'}<p class="text">{text}</p>{/if}
	{/if}
</article>

<style>
	/*
	 * Pixel convention as in Paper: grid lines lie at 0, 40, 80 … and occupy [x, x+1).
	 * The tile spans n fields and leaves exactly this line free at the top and left.
	 */
	.tile {
		--n: 2;
		grid-column: span var(--n);
		grid-row: span var(--n);
		margin: var(--hair) 0 0 var(--hair);
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: var(--space-2);
		background: var(--cat);
		color: var(--on-cat);
		overflow: hidden;
	}
	[data-size='s'] {
		--n: 1;
		padding: var(--space-1);
	}
	[data-size='l'] {
		--n: 3;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-1);
	}
	h3 {
		font-size: var(--text-xs);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.idx {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.value {
		margin-top: auto;
		font-size: var(--text-l);
		font-weight: 300;
		letter-spacing: -0.03em;
		line-height: 1;
		white-space: nowrap;
	}
	[data-size='l'] .value {
		font-size: var(--text-xl);
	}
	.text {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		margin-top: var(--space-1);
	}
</style>
