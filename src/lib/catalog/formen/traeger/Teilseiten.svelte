<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { tragwerkeSeite } from '../../data/traeger';
</script>

<nav aria-label="Forms">
	<ul>
		{#each tragwerkeSeite.teilseiten as t (t.pfad)}<li>
				<a
					href={resolve(t.pfad)}
					aria-current={page.url.pathname === resolve(t.pfad) ? 'page' : undefined}>{t.name}</a
				>
			</li>{/each}
	</ul>
</nav>

<style>
	nav {
		margin-top: calc(-1 * var(--space-6));
		margin-bottom: var(--space-10);
	}
	ul {
		display: flex;
		gap: var(--space-4);
		list-style: none;
		padding: 0;
	}
	li + li {
		border-left: var(--hair) solid var(--line);
		padding-left: var(--space-4);
	}
	a {
		color: var(--ink-2);
		text-decoration: none;
		font-size: var(--text-s);
	}
	a[aria-current] {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 5px;
	}
	a:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 4px;
	}
</style>
