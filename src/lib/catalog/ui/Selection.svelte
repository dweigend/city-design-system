<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SelectionVariant } from '../data/system';
	import Tag from './Tag.svelte';
	let {
		variant = 'frame',
		label,
		color = 'var(--blueprint)',
		onColor = 'var(--on-accent)',
		children
	}: {
		variant?: SelectionVariant;
		label: string;
		color?: string;
		onColor?: string;
		children: Snippet;
	} = $props();
</script>

<div class="sel" data-variant={variant} style:--mark={color} style:--on-mark={onColor}>
	<span class="tag"
		><Tag
			text={label}
			color={variant === 'mark' ? color : undefined}
			onColor={variant === 'mark' ? onColor : undefined}
		/></span
	>
	{#if variant === 'mark'}<span class="c tl"></span><span class="c tr"></span><span class="c bl"
		></span><span class="c br"></span>{/if}
	{@render children()}
</div>

<style>
	.sel {
		position: relative;
		display: inline-grid;
		place-items: center;
		padding: var(--space-4);
		margin-top: var(--space-6);
	}
	.tag {
		position: absolute;
		left: calc(-1 * var(--hair));
		bottom: 100%;
		display: flex;
	}

	[data-variant='frame'] {
		outline: var(--hair) dashed var(--ink);
	}

	[data-variant='mark'] {
		outline: var(--hair) solid var(--mark);
	}
	.c {
		position: absolute;
		width: var(--space-2);
		height: var(--space-2);
		background: var(--mark);
	}
	.c {
		--o: calc(-1 * var(--space-1));
	}
	.tl {
		top: var(--o);
		left: var(--o);
	}
	.tr {
		top: var(--o);
		right: var(--o);
	}
	.bl {
		bottom: var(--o);
		left: var(--o);
	}
	.br {
		bottom: var(--o);
		right: var(--o);
	}
</style>
