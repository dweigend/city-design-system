<script lang="ts">
	import { RadioGroup } from 'bits-ui';
	import { resolve } from '$app/paths';
	import { ArrowRight } from 'lucide-svelte';
	import PrincipleGlyph from './PrincipleGlyph.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Vertiefung from '../ui/Vertiefung.svelte';
	import type { Prinzip } from '../data/prinzipien';
	import type { Experiment } from '../data/labor';

	/**
	 * Twelve principles as a compact strip: image and name per principle, below it the selected one with
	 * sentence, player and engine side and its experiment. An experiment lives in the chapter (link),
	 * in the simulation above (button sets the preset) or with the studies below (anchor).
	 * The invariant sits one level deeper.
	 */
	let {
		items,
		experimente,
		onsimulation
	}: {
		items: Prinzip[];
		experimente: Record<string, Experiment>;
		onsimulation: (voreinstellung: string) => void;
	} = $props();

	let wahl = $state<string>();
	const p = $derived(items.find((x) => x.id === wahl) ?? items[0]);
	const nr = $derived(items.indexOf(p) + 1);
	const ex = $derived(experimente[p.id]);
	const href = (e: Experiment) =>
		e.art === 'kapitel'
			? resolve(e.pfad) + (e.anker ? `#${e.anker}` : '')
			: e.art === 'studie'
				? `#${e.anker}`
				: '';
</script>

<div class="prinzipien">
	<RadioGroup.Root
		bind:value={() => p.id, (v) => (wahl = v)}
		aria-label="Choose a principle"
		orientation="horizontal"
		class="cg-prinzip-leiste"
	>
		{#each items as x, i (x.id)}
			<RadioGroup.Item
				value={x.id}
				class="cg-prinzip"
				aria-label="{i + 1}. {x.titel}"
				title={x.titel}
			>
				<span class="glyph"><PrincipleGlyph glyph={x.glyph} /></span>
				<span class="i">{i + 1}</span>
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>

	<article class="detail" aria-live="polite">
		<header>
			<span class="i">{nr}</span>
			<h3>{p.titel}</h3>
			<p class="satz">{p.satz}</p>
		</header>
		<dl>
			<div>
				<dt>You see</dt>
				<dd>{p.spieler}</dd>
			</div>
			<div>
				<dt>The engine</dt>
				<dd>{p.engine}</dd>
			</div>
		</dl>
		<div class="fuss">
			{#if ex?.art === 'simulation'}
				<Button
					variant="secondary"
					label="Show in the simulation"
					onclick={() => onsimulation(ex.voreinstellung)}
				/>
				<span class="wo">{ex.name}</span>
			{:else if ex}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href goes through resolve() or is an anchor. -->
				<a class="weiter" href={href(ex)}>{ex.name}<Icon icon={ArrowRight} size={16} /></a>
			{/if}
		</div>
		<Vertiefung label="What always applies">
			<p class="invariante">{p.invariante}</p>
		</Vertiefung>
	</article>
</div>

<style>
	.prinzipien {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	:global(.cg-prinzip-leiste) {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: var(--space-1);
	}
	:global(.cg-prinzip) {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		min-height: 44px;
		padding: var(--space-2);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink-2);
		font: inherit;
		font-size: var(--text-xs);
		line-height: 1.3;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
		transition: border-color var(--fast) var(--ease);
	}
	:global(.cg-prinzip:hover) {
		color: var(--ink);
		border-color: var(--ink-3);
	}
	:global(.cg-prinzip[data-state='checked']) {
		color: var(--ink);
		border-color: var(--ink);
		outline: var(--hair) solid var(--ink);
	}
	:global(.cg-prinzip:focus-visible) {
		outline: var(--stroke) solid var(--ink);
		outline-offset: 2px;
	}
	.glyph {
		display: block;
		color: var(--ink);
	}
	.glyph :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
	.i {
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
	}
	.detail {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-4) var(--space-8);
		padding-top: var(--space-4);
		border-top: var(--hair) solid var(--line);
	}
	header {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: var(--space-1) var(--space-3);
		align-items: baseline;
	}
	header .i {
		font-size: var(--text-m);
	}
	h3 {
		font-size: var(--text-m);
		font-weight: 600;
	}
	.satz {
		grid-column: 2;
		max-width: 62ch;
		line-height: 1.5;
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-6);
	}
	dt {
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	dd {
		margin: var(--space-1) 0 0;
		font-size: var(--text-s);
		line-height: 1.5;
	}
	.fuss {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.wo {
		font-size: var(--text-xs);
		color: var(--ink-2);
	}
	.weiter {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		color: var(--ink);
		font-size: var(--text-s);
		font-weight: 500;
		text-underline-offset: 3px;
	}
	.detail > :global(.vertiefung) {
		grid-column: 1 / -1;
	}
	.invariante {
		max-width: 62ch;
		font-size: var(--text-s);
		line-height: 1.5;
	}
	@media (max-width: 960px) {
		:global(.cg-prinzip-leiste) {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}
		.detail,
		dl {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		:global(.cg-prinzip) {
			padding: var(--space-1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.cg-prinzip) {
			transition: none;
		}
	}
</style>
