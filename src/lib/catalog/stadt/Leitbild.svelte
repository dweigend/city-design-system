<script lang="ts">
	import { ArrowDown } from 'lucide-svelte';
	import { flowToken } from '../data/focus';
	import type { Leitidee, LeitideeTon } from '../data/vision';

	/**
	 * Header of the home page: one sentence as the guiding vision, beside it stance and references, below it the
	 * guiding ideas as jump links to the sections. The bar above each link carries the color
	 * of its flow (existing stock stays gray), the same color as in the image below.
	 */
	let {
		claim,
		haltung,
		einfluesse,
		leitideen
	}: { claim: string; haltung: string; einfluesse: string[]; leitideen: Leitidee[] } = $props();

	const ton = (t: LeitideeTon) => `var(${t === 'bestand' ? '--ink-3' : flowToken[t]})`;
</script>

<div class="leitbild">
	<p class="claim">{claim}</p>
	<p class="haltung">
		{haltung} References: {einfluesse.join(', ')}.
	</p>
	<nav aria-label="Guiding ideas">
		<ul>
			{#each leitideen as l (l.ziel)}
				<li style:--ton={ton(l.ton)}>
					<a href="#{l.ziel}">
						<span class="titel"
							>{l.titel}<ArrowDown size={14} strokeWidth={1.5} aria-hidden="true" /></span
						>
						<span class="text">{l.text}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>

<style>
	/* Same alignment lines as DemoLayout: 2fr image, 1fr controls. */
	.leitbild {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-8);
		align-items: end;
		margin-top: calc(-1 * var(--space-4));
		margin-bottom: var(--space-12);
	}
	.claim {
		max-width: 40ch;
		font-size: var(--text-l);
		line-height: 1.25;
		letter-spacing: -0.01em;
		text-wrap: balance;
	}
	.haltung {
		max-width: 44ch;
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	nav {
		grid-column: 1 / -1;
	}
	ul {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-6);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	a {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		height: 100%;
		padding-top: var(--space-3);
		border-top: 3px solid var(--ton);
		color: var(--ink);
		text-decoration: none;
	}
	.titel {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-2);
		font-weight: 600;
	}
	.titel :global(svg) {
		flex: none;
		margin-top: 0.2em;
		color: var(--ink-3);
		transition: transform var(--fast) var(--ease);
	}
	.text {
		font-size: var(--text-s);
		line-height: 1.45;
		color: var(--ink-2);
	}
	a:hover .titel :global(svg) {
		color: var(--ink);
		transform: translateY(2px);
	}
	a:focus-visible {
		outline: var(--stroke) solid var(--ink);
		outline-offset: var(--space-1);
	}
	@media (prefers-reduced-motion: reduce) {
		.titel :global(svg) {
			transition: none;
		}
	}
	@media (max-width: 960px) {
		.leitbild {
			grid-template-columns: 1fr;
			gap: var(--space-4);
			margin-bottom: var(--space-12);
		}
		nav {
			margin-top: var(--space-4);
		}
		ul {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-6) var(--space-4);
		}
	}
	@media (max-width: 720px) {
		.claim {
			font-size: var(--text-m);
			font-weight: 500;
		}
		/* On mobile only the titles: the first experiment should be in view quickly. */
		.titel {
			font-size: var(--text-s);
		}
		.text {
			display: none;
		}
		ul {
			gap: var(--space-4) var(--space-4);
		}
	}
</style>
