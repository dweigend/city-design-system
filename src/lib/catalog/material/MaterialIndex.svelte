<script lang="ts">
	import { materialIndex } from '../data/materialKapitel';

	/**
	 * Page index of the Material chapter: two groups, surface workflow and explanation.
	 * Plain anchor links, so every section stays reachable by deep link, keyboard and screen reader.
	 */
</script>

<nav class="index" aria-label="On this page">
	{#each materialIndex as gruppe (gruppe.id)}
		<div class="gruppe">
			<p id={gruppe.id} class="titel">{gruppe.titel}</p>
			<ul aria-labelledby={gruppe.id}>
				{#each gruppe.links as link (link.id)}
					<li><a href="#{link.id}">{link.label}</a></li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>

<style>
	.index {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		gap: var(--space-4) var(--space-8);
		margin-bottom: var(--space-12);
		font-size: var(--text-s);
	}
	.gruppe {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: var(--hair) solid var(--line);
	}
	.titel {
		color: var(--ink-2);
	}
	ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--line);
		text-underline-offset: 4px;
		transition: text-decoration-color var(--fast) var(--ease);
	}
	a:hover {
		text-decoration-color: var(--ink);
	}
	a:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	@media (max-width: 960px) {
		.index {
			grid-template-columns: 1fr;
			margin-bottom: var(--space-8);
		}
		a {
			min-height: 44px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		a {
			transition: none;
		}
	}
</style>
