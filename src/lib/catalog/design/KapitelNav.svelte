<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { kapitelGruppen } from '../data/kapitel';

	/**
	 * Chapters in two groups, Bible and workshop. In the header bar side by side,
	 * as `compact` stacked with group names (popover on narrow screens).
	 */
	let { compact = false, onnavigate }: { compact?: boolean; onnavigate?: () => void } = $props();

	const groups = kapitelGruppen.map((g) => ({
		id: g.id,
		label: g.titel,
		links: g.kapitel.map((k) => ({ href: resolve(k.pfad), label: k.titel }))
	}));
</script>

<nav aria-label="Chapters" class="kapitel" class:compact>
	{#each groups as g (g.id)}
		<ul aria-label={g.label}>
			{#if compact}<li class="gruppe" aria-hidden="true">{g.label}</li>{/if}
			{#each g.links as l (l.href)}
				<li>
					<a
						href={l.href}
						aria-current={page.url.pathname === l.href ||
						(l.href !== resolve('/') && page.url.pathname.startsWith(l.href + '/'))
							? 'page'
							: undefined}
						onclick={onnavigate}>{l.label}</a
					>
				</li>
			{/each}
		</ul>
	{/each}
</nav>

<style>
	.kapitel {
		display: flex;
		gap: var(--space-4);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	ul {
		display: flex;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Workshop: separated from the Bible by a hairline. */
	ul + ul {
		padding-left: var(--space-4);
		border-left: var(--hair) solid var(--line);
	}
	a {
		color: var(--ink-2);
		text-decoration: none;
		white-space: nowrap;
		transition: color var(--fast) var(--ease);
	}
	a:hover,
	a[aria-current='page'] {
		color: var(--ink);
	}
	a[aria-current='page'] {
		text-decoration: underline;
		text-decoration-thickness: var(--hair);
		text-underline-offset: 6px;
	}

	.compact {
		display: grid;
	}
	.compact ul {
		display: grid;
		gap: 0;
	}
	.compact ul + ul {
		margin-top: var(--space-4);
		padding: var(--space-4) 0 0;
		border-left: 0;
		border-top: var(--hair) solid var(--line);
	}
	.compact a {
		display: block;
		padding: var(--space-2) 0;
	}
	.gruppe {
		padding-bottom: var(--space-1);
		color: var(--ink-3);
	}
</style>
