<script lang="ts">
	import type { TypeRole } from '../data/tokens';
	let { roles }: { roles: TypeRole[] } = $props();
</script>

<div class="scale">
	{#each roles as r (r.id)}
		<div class="row">
			<div class="meta"><span>{r.name}</span><code>{r.spec}</code></div>
			<p class="sample" data-role={r.id}>{r.sample}</p>
		</div>
	{/each}
</div>

<style>
	.scale {
		display: flex;
		flex-direction: column;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 3fr;
		gap: var(--space-8);
		align-items: baseline;
		padding: var(--space-4) 0;
	}
	.meta {
		display: flex;
		flex-direction: column;
		font-size: var(--text-s);
	}
	code {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	[data-role='display'] {
		font-size: var(--text-xl);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: -0.03em;
		line-height: 1;
	}
	[data-role='figure'] {
		font-size: var(--text-xxl);
		font-weight: 300;
		letter-spacing: -0.04em;
		line-height: 1;
	}
	[data-role='title'] {
		font-size: var(--text-m);
		font-weight: 600;
		text-transform: uppercase;
	}
	[data-role='body'] {
		font-size: var(--text-m);
		max-width: 52ch;
	}
	[data-role='small'] {
		font-size: var(--text-s);
	}
	[data-role='label'] {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	@media (max-width: 960px) {
		.row {
			grid-template-columns: 1fr;
			gap: var(--space-2);
		}
	}
</style>
