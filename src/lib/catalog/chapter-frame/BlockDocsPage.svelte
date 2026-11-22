<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronLeft } from 'lucide-svelte';
	import type { Chapter } from '../data/chapters';
	import BibleMenu from './BibleMenu.svelte';
	import BlockDemo from './BlockDemo.svelte';
	import BlockIndex from './BlockIndex.svelte';
	import BlockInputsTable from './BlockInputsTable.svelte';
	import type { ContractDoc } from './contract-docs';

	let { chapter, doc, docs }: { chapter: Chapter; doc: ContractDoc; docs: readonly ContractDoc[] } =
		$props();
	const example = $derived(doc.example ?? (doc.kind === 'example' ? doc.key : undefined));
</script>

<svelte:head><title>{doc.title} · {chapter.title}</title></svelte:head>
<a class="skip" href="#block-documentation">Skip to documentation</a>
<BibleMenu />

<main>
	<div class="back">
		<a href={resolve('/[...bible]', { bible: chapter.slug }) + '#' + chapter.libraryDocs?.index}>
			<ChevronLeft size={16} aria-hidden="true" />
			Building blocks
		</a>
	</div>

	<div class="docs">
		<aside><BlockIndex {docs} current={doc.slug} /></aside>

		<article id="block-documentation" tabindex="-1">
			<header>
				<h1>{doc.title}</h1>
				<p>{doc.purpose}</p>
				<dl>
					<dt>Kind</dt>
					<dd>{doc.kind}</dd>
				</dl>
				<pre><code translate="no">{doc.importLine}</code></pre>
			</header>

			{#if example}
				<section aria-labelledby="example">
					<h2 id="example">Live example</h2>
					<div class="example">
						{#key doc.key}<BlockDemo {example} />{/key}
					</div>
				</section>
			{/if}

			<section aria-labelledby="inputs">
				<h2 id="inputs">Inputs</h2>
				<BlockInputsTable inputs={doc.inputs} />
			</section>

			<section aria-labelledby="outputs">
				<h2 id="outputs">Outputs</h2>
				<p>{doc.outputs}</p>
			</section>
		</article>
	</div>
</main>

<style>
	main {
		--chapter-target: 44px;
		--chapter-stage-height: clamp(17rem, 42vh, 24rem);
		max-width: 76rem;
		margin-inline: auto;
		padding: 0 var(--space-5) var(--space-6);
	}
	.skip {
		position: absolute;
		z-index: 2;
		translate: 0 -100%;
		padding: var(--space-2);
		background: var(--paper);
	}
	.skip:focus-visible {
		translate: 0;
	}
	.back {
		border-block-end: var(--hair) solid var(--line);
	}
	.back a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: 44px;
		color: var(--ink);
		font-size: var(--text-s);
	}
	.back a:hover {
		color: var(--ink-2);
	}
	.docs {
		display: grid;
		grid-template-columns: 13rem minmax(0, 1fr);
		gap: var(--space-6);
		padding-top: var(--space-5);
	}
	aside {
		border-inline-end: var(--hair) solid var(--line);
		padding-inline-end: var(--space-3);
	}
	article {
		display: grid;
		gap: var(--space-5);
		min-width: 0;
	}
	header {
		display: grid;
		gap: var(--space-2);
	}
	h1 {
		font-size: var(--text-xl);
		font-weight: 650;
		line-height: 1.1;
		text-wrap: balance;
	}
	h2 {
		margin-bottom: var(--space-2);
		font-size: var(--text-m);
		font-weight: 650;
	}
	p {
		color: var(--ink-2);
		text-wrap: pretty;
	}
	dl {
		display: flex;
		gap: var(--space-2);
		font-size: var(--text-s);
	}
	dt {
		color: var(--ink-2);
	}
	dd {
		margin: 0;
	}
	pre {
		margin: 0;
		padding: var(--space-2);
		border: var(--hair) solid var(--line);
		background: var(--paper-2);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	code {
		font: var(--text-s) var(--font-mono);
	}
	.example {
		border: var(--hair) solid var(--line);
	}
	.example :global(button) {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--chapter-target);
		touch-action: manipulation;
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
	}
	.example :global(button:not(:disabled):hover),
	.example :global(button[data-state='on']) {
		background: var(--paper-3);
	}
	.example :global(button:disabled) {
		color: var(--ink-3);
	}
	.example :global(button:focus-visible) {
		z-index: 1;
		outline-offset: -3px;
	}
	@media (max-width: 760px) {
		main {
			--chapter-stage-height: 15rem;
			padding-inline: var(--space-3);
		}
		.docs {
			display: block;
			padding-top: var(--space-3);
		}
		aside {
			display: none;
		}
		h1 {
			font-size: var(--text-l);
		}
	}
</style>
