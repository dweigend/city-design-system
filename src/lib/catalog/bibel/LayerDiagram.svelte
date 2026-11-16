<script lang="ts">
	import type { Schicht } from '../data/prinzipien';
	/** Layer model: semantics → topology → geometry → presentation, with transitions and a way back. */
	let { layers, steps, back }: { layers: Schicht[]; steps: string[]; back: string } = $props();
</script>

<figure>
	<ol class="layers" aria-label="Layers from intent to image">
		{#each layers as l, i (l.id)}
			<li data-layer={l.id}>
				<div class="head">
					<span class="num">{String(i + 1).padStart(2, '0')}</span>
					<b>{l.titel}</b>
					<span class="q">{l.frage}</span>
				</div>
				<dl>
					<dt>Stored</dt>
					<dd>{l.autoritativ}</dd>
					<dt>Derived</dt>
					<dd>{l.abgeleitet}</dd>
				</dl>
				{#if i < steps.length}<span class="step" aria-label="next: {steps[i]}"
						><span aria-hidden="true">→</span> {steps[i]}</span
					>{/if}
			</li>
		{/each}
	</ol>
	<figcaption><span class="back" aria-hidden="true">←</span>{back}</figcaption>
</figure>

<style>
	figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.layers {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-8);
	}
	li {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-3);
		border: var(--hair) solid var(--ink);
		background: var(--paper);
		font-size: var(--text-s);
	}
	/* Presentation has no authority: dashed. */
	li[data-layer='darstellung'] {
		border-style: dashed;
		background: transparent;
	}
	li[data-layer='semantik'] {
		box-shadow: inset 0 var(--bar) 0 var(--signal);
		padding-top: calc(var(--space-3) + var(--bar));
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.num,
	.q,
	dt,
	.step {
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	.num {
		font-variant-numeric: tabular-nums;
	}
	b {
		font-size: var(--text-m);
		font-weight: 600;
	}
	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	dd {
		margin: 0 0 var(--space-2);
	}
	.step {
		position: absolute;
		top: 50%;
		right: calc(-1 * var(--space-8));
		width: var(--space-8);
		transform: translateY(-50%) rotate(-90deg);
		text-align: center;
		color: var(--ink);
		white-space: nowrap;
	}
	figcaption {
		display: flex;
		gap: var(--space-2);
		max-width: 72ch;
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	.back {
		color: var(--ink);
	}
	@media (max-width: 960px) {
		.layers {
			grid-template-columns: 1fr;
			gap: var(--space-10);
		}
		.step {
			top: auto;
			right: auto;
			bottom: calc(-1 * var(--space-8));
			left: var(--space-3);
			width: auto;
			height: var(--space-8);
			line-height: var(--space-8);
			transform: none;
			text-align: left;
		}
		.step span {
			display: inline-block;
			transform: rotate(90deg);
		}
	}
</style>
