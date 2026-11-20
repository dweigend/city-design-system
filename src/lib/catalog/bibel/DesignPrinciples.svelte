<script lang="ts">
	import { Accordion } from 'bits-ui';
	import { resolve } from '$app/paths';
	import { ArrowRight, ChevronRight } from 'lucide-svelte';
	import Icon from '../ui/Icon.svelte';
	import { principlesFor, type PrinciplePage } from '../data/design-principles';

	/**
	 * Principles block of a bible page: every design rule the page owns, read from the register.
	 * Id, name and rule are always visible; the reason and the way to the live demo sit one click
	 * below. Each row carries its id as anchor, so a brief can link to a single rule.
	 */
	let { page }: { page: PrinciplePage } = $props();
	const principles = $derived(principlesFor(page));
</script>

<section class="block" aria-labelledby="principles-{page}">
	<h2 id="principles-{page}">Principles</h2>
	<Accordion.Root type="multiple" class="cg-principles">
		{#each principles as p (p.id)}
			<Accordion.Item value={p.id} id={p.id} class="cg-principle">
				<Accordion.Header level={3} class="cg-principle-head">
					<Accordion.Trigger class="cg-principle-trigger">
						<span class="id">{p.id}</span>
						<span class="rule"><strong>{p.title}.</strong> {p.rule}</span>
						<span class="arrow"><Icon icon={ChevronRight} size={16} /></span>
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content class="cg-principle-body">
					<p>{p.reason}</p>
					{#if p.demo}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the route goes through resolve(); only the anchor is appended. -->
						<a href={resolve(p.demo.route) + (p.demo.anchor ? `#${p.demo.anchor}` : '')}
							>{p.demo.label}<Icon icon={ArrowRight} size={16} /></a
						>
					{/if}
				</Accordion.Content>
			</Accordion.Item>
		{/each}
	</Accordion.Root>
</section>

<style>
	.block {
		padding-bottom: var(--space-12);
	}
	h2 {
		margin-bottom: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-2);
	}
	/* Two columns of rules; an opened row grows only its own cell. */
	:global(.cg-principles) {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: var(--space-8);
		align-items: start;
	}
	:global(.cg-principle) {
		border-top: var(--hair) solid var(--line);
		scroll-margin-top: var(--space-4);
	}
	:global(.cg-principle-head) {
		margin: 0;
		font: inherit;
	}
	:global(.cg-principle-trigger) {
		display: grid;
		grid-template-columns: 9ch minmax(0, 1fr) auto;
		gap: var(--space-3);
		align-items: baseline;
		width: 100%;
		min-height: var(--u10);
		padding: var(--space-3) 0;
		border: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: var(--text-s);
		line-height: 1.45;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	:global(.cg-principle-trigger:hover) .rule {
		text-decoration: underline;
		text-decoration-color: var(--ink-3);
		text-underline-offset: 3px;
	}
	:global(.cg-principle-trigger:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	.id {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		color: var(--ink-2);
		white-space: nowrap;
	}
	.rule {
		max-width: 62ch;
	}
	strong {
		font-weight: 600;
	}
	.arrow {
		display: inline-flex;
		align-self: center;
		color: var(--ink-2);
		transition: transform var(--fast) var(--ease);
	}
	:global(.cg-principle[data-state='open']) .arrow {
		transform: rotate(90deg);
	}
	:global(.cg-principle-body) {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		/* Aligned with the rule text: id column plus gap. */
		padding: 0 var(--space-6) var(--space-4) calc(9ch + var(--space-3));
		font-size: var(--text-s);
		line-height: 1.5;
		color: var(--ink-2);
	}
	p {
		max-width: 62ch;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--ink);
		font-weight: 500;
		text-underline-offset: 3px;
	}
	@media (max-width: 960px) {
		:global(.cg-principles) {
			grid-template-columns: 1fr;
		}
		:global(.cg-principle-trigger) {
			grid-template-columns: 8ch minmax(0, 1fr) auto;
			min-height: 44px;
		}
		:global(.cg-principle-body) {
			padding-left: calc(8ch + var(--space-3));
		}
		a {
			min-height: 44px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.arrow {
			transition: none;
		}
	}
</style>
