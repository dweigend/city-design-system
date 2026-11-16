<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Icon from '../ui/Icon.svelte';
	import type { IconGroesse } from '../data/icons';

	type Zeichnung = ComponentProps<typeof Icon>['icon'];
	/**
	 * Icons as a grid: per icon a size row like a type specimen, below it name, text and identifier.
	 * `ton` fills the surface (meaning token). `vergleich` sets the line beside the color.
	 */
	let {
		items,
		label,
		sizes = [48, 24, 20, 16],
		vergleich = false
	}: {
		items: {
			id: string;
			icon: Zeichnung;
			name: string;
			text?: string;
			code?: string;
			ton?: string;
		}[];
		label: string;
		sizes?: IconGroesse[];
		vergleich?: boolean;
	} = $props();
</script>

<ul aria-label={label}>
	{#each items as it (it.id)}
		<li>
			<div class="reihe" aria-hidden="true">
				{#if vergleich}<Icon icon={it.icon} size={sizes[0]} />{/if}
				{#each sizes as s (s)}<Icon icon={it.icon} size={s} ton={it.ton} />{/each}
			</div>
			<b>{it.name}</b>
			{#if it.text}<span>{it.text}</span>{/if}
			{#if it.code}<code>{it.code}</code>{/if}
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(var(--u50), 100%), 1fr));
		gap: var(--space-8) var(--space-6);
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding-top: var(--space-4);
		border-top: var(--hair) solid var(--line);
		font-size: var(--text-s);
	}
	/* Size row on one baseline. The margin of the drawing (2 of 24) is compensated on the left. */
	.reihe {
		display: flex;
		align-items: flex-end;
		gap: var(--space-4);
		margin: 0 0 var(--space-3) calc(-1 * var(--u));
	}
	b {
		font-weight: 600;
	}
	span {
		color: var(--ink-2);
	}
	code {
		margin-top: auto;
		padding-top: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	/* Narrow: two columns, tighter row. */
	@media (max-width: 720px) {
		ul {
			grid-template-columns: repeat(
				auto-fill,
				minmax(min(calc(4 * var(--u10) - var(--u)), 100%), 1fr)
			);
			column-gap: var(--space-4);
		}
		.reihe {
			gap: var(--space-2);
		}
	}
</style>
