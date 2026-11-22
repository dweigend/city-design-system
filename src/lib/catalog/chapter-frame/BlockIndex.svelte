<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight } from 'lucide-svelte';
	import { pendingContracts } from '../data/chapters';
	import { docKinds, type ContractDoc } from './contract-docs';

	let { docs, current }: { docs: readonly ContractDoc[]; current?: string } = $props();
	const labels = { block: 'Blocks', recipe: 'Recipes', example: 'Examples' };
</script>

<nav aria-label="Building blocks" class:sidebar={current !== undefined}>
	{#each docKinds as kind (kind)}
		{@const entries = docs.filter((doc) => doc.kind === kind)}
		{#if entries.length}
			<div class="group">
				<svelte:element this={current === undefined ? 'h3' : 'h2'} class="group-title">
					{labels[kind]}
				</svelte:element>
				<ul>
					{#each entries as doc (doc.key)}
						<li>
							<a
								href={resolve('/bausteine/[block]', { block: doc.slug })}
								aria-current={current === doc.slug ? 'page' : undefined}
							>
								<span>
									<strong>{doc.title}</strong>
									{#if current === undefined}<span class="purpose">{doc.purpose}</span>{/if}
								</span>
								{#if current === undefined}<ChevronRight size={16} aria-hidden="true" />{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/each}
</nav>

{#if current === undefined}
	<section class="pending">
		<h3 class="group-title">Pending contracts and demos</h3>
		<ul>
			{#each pendingContracts as entry (entry.key)}
				<li>{entry.title}</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	nav {
		display: grid;
		align-content: start;
		gap: var(--space-5);
	}
	.group-title {
		margin-bottom: var(--space-1);
		font-size: var(--text-s);
		font-weight: 650;
		color: var(--ink-2);
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	li {
		border-top: var(--hair) solid var(--line);
	}
	li:last-child {
		border-bottom: var(--hair) solid var(--line);
	}
	a {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: var(--space-2);
		color: var(--ink);
		text-decoration: none;
		touch-action: manipulation;
	}
	a:hover,
	a[aria-current='page'] {
		background: var(--paper-3);
	}
	a:focus-visible {
		outline-offset: -3px;
	}
	strong {
		font-weight: 600;
	}
	.purpose {
		display: block;
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.sidebar {
		gap: var(--space-3);
		font-size: var(--text-s);
	}
	.sidebar li {
		border: 0;
	}
	.sidebar a {
		min-height: 44px;
	}
	.pending {
		margin-top: var(--space-5);
	}
	.pending li {
		padding: var(--space-2);
		color: var(--ink-2);
		font-size: var(--text-s);
	}
</style>
