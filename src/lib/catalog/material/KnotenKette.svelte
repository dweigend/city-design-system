<script lang="ts">
	import type { Phase } from '../data/materialSeite';

	/**
	 * Node chain of the kit: six nodes, connected into the material. Switched nodes in
	 * ink, the running one filled, upcoming ones dashed. Below it the TSL line of the running
	 * node. Display only; selection happens in the step strip on the right.
	 */
	let { phasen, index, code }: { phasen: readonly Phase[]; index: number; code: string } = $props();
</script>

<div class="kette">
	<ol aria-label="Nodes of the recipe">
		{#each phasen as p, i (p.id)}
			<li
				class:an={i < index}
				class:jetzt={i === index}
				aria-current={i === index ? 'step' : undefined}
			>
				<span class="knoten">{p.titel}</span>
			</li>
		{/each}
		<li class="aus" class:an={index === phasen.length - 1}>
			<span class="knoten">Material</span>
		</li>
	</ol>
	<pre aria-label="TSL code of the node"><code>{code}</code></pre>
</div>

<style>
	.kette {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	ol {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		position: relative;
		min-width: 0;
	}
	/* Connection to the next node. */
	li:not(:last-child)::after {
		content: '';
		position: absolute;
		top: 50%;
		right: calc(-1 * var(--space-3));
		width: var(--space-3);
		border-top: var(--hair) dashed var(--ink-3);
	}
	li.an:not(:last-child)::after,
	li.jetzt:not(:last-child)::after {
		border-top-style: solid;
		border-top-color: var(--ink);
	}
	.knoten {
		display: block;
		overflow: hidden;
		padding: var(--space-1) var(--space-2);
		border: var(--hair) dashed var(--ink-3);
		color: var(--ink-2);
		font-size: var(--text-xs);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
		transition:
			color var(--fast) var(--ease),
			background var(--fast) var(--ease);
	}
	.an .knoten {
		border-style: solid;
		border-color: var(--ink);
		color: var(--ink);
	}
	.jetzt .knoten {
		border-style: solid;
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
		font-weight: 600;
	}
	.aus .knoten {
		border-radius: 999px;
	}
	pre {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		overflow-x: auto;
		border-left: var(--stroke) solid var(--ink);
		background: color-mix(in srgb, var(--ink) 4%, var(--paper));
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	@media (max-width: 720px) {
		ol {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			row-gap: var(--space-2);
		}
		li:nth-child(4)::after {
			display: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.knoten {
			transition: none;
		}
	}
</style>
