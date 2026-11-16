<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { kapitelGruppen } from '../data/kapitel';

	/**
	 * Signpost at the end of the page: all other chapters in reading order, each with its key statement.
	 * The current page is missing. The source is the same list as for the header bar.
	 */
	const ziele = $derived(
		kapitelGruppen
			.flatMap((g) => g.kapitel)
			.map((k) => ({ ...k, href: resolve(k.pfad) }))
			.filter((k) => k.href !== page.url.pathname)
	);
</script>

<nav class="wegweiser" aria-labelledby="wegweiser-titel">
	<h2 id="wegweiser-titel">Continue in the Bible</h2>
	<ul>
		{#each ziele as k (k.pfad)}
			<li>
				<a href={k.href}>
					<span class="titel">{k.titel}</span>
					<span class="text">{k.text}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.wegweiser {
		padding-top: var(--space-6);
		border-top: var(--hair) solid var(--ink);
	}
	h2 {
		margin-bottom: var(--space-8);
		font-size: var(--text-l);
		font-weight: 600;
		line-height: 1.15;
		letter-spacing: -0.01em;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-8) var(--space-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding-top: var(--space-2);
		border-top: var(--hair) solid var(--line);
		color: var(--ink);
		text-decoration: none;
		transition: border-color var(--fast) var(--ease);
	}
	a:hover {
		border-top-color: var(--ink);
	}
	a:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: var(--space-1);
	}
	.titel {
		font-weight: 600;
	}
	.text {
		font-size: var(--text-s);
		line-height: 1.45;
		color: var(--ink-2);
	}
	@media (max-width: 960px) {
		ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-6) var(--space-4);
		}
	}
</style>
