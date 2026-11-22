<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { afterNavigate } from '$app/navigation';
	import { tick } from 'svelte';
	import BibleMenu from './BibleMenu.svelte';
	import BlockIndex from './BlockIndex.svelte';
	import type { ContractDoc } from './contract-docs';
	import type { Chapter } from '../data/chapters';
	import { createChapterController } from './chapter-controller.svelte';
	import ChapterStage from './ChapterStage.svelte';
	import StepCard from './StepCard.svelte';

	let { chapter, docs = [] }: { chapter: Chapter; docs?: readonly ContractDoc[] } = $props();
	let stepList = $state<HTMLElement | null>(null);
	let headerHeight = $state(0);
	let menuHeight = $state(0);
	const controller = createChapterController(() => chapter.steps);
	const docsSelected = $derived(
		controller.step !== undefined &&
			(chapter.libraryDocs?.steps.includes(controller.step.id) ?? false)
	);

	// The browser owns the fragment. Render a selected card only after reading it.
	afterNavigate(controller.syncLocation);

	$effect(() => {
		const id = controller.step?.id;
		const list = stepList;
		if (!id || !list) return;
		void tick().then(() => {
			const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
			if (!active) return;
			const viewport = list.getBoundingClientRect();
			const tab = active.getBoundingClientRect();
			if (tab.left < viewport.left) list.scrollLeft += tab.left - viewport.left;
			else if (tab.right > viewport.right) list.scrollLeft += tab.right - viewport.right;
		});
	});
</script>

<svelte:head><title>{chapter.title} · City Design System</title></svelte:head>
<svelte:window onhashchange={controller.syncLocation} onpopstate={controller.syncLocation} />

<BibleMenu bind:height={menuHeight} />

<main
	class:docs-selected={docsSelected}
	style:--chapter-header-height={headerHeight + menuHeight + 'px'}
>
	{#each chapter.steps as item (item.id)}
		<span class="anchor" id={item.id}></span>
	{/each}

	<header bind:offsetHeight={headerHeight}>
		<div>
			<p class="chapter-number">Chapter {chapter.number}</p>
			<h1>{chapter.title}</h1>
			<p class="summary">{chapter.summary}</p>
		</div>
		{#if controller.seed !== undefined}
			<span class="chapter-seed">Seed {controller.seed}</span>
		{/if}
	</header>

	<Tabs.Root
		value={controller.step?.id ?? ''}
		onValueChange={controller.selectStep}
		class="chapter-body"
	>
		{#if controller.step}
			{#key controller.step.preset.scene}
				<ChapterStage scene={controller.step.preset.scene} {controller} compact={docsSelected} />
			{/key}
		{:else}
			<div class="stage-placeholder" aria-hidden="true"></div>
		{/if}

		<div class="reading">
			<Tabs.List aria-label="Chapter steps" class="steps" bind:ref={stepList}>
				{#each chapter.steps as item (item.id)}
					<Tabs.Trigger value={item.id}>
						<span class="step-number">{item.id.slice('step-'.length)}</span>
						<span>{item.label ?? item.title}</span>
					</Tabs.Trigger>
				{/each}
			</Tabs.List>

			{#each chapter.steps as item (item.id)}
				<Tabs.Content value={item.id}>
					{#if controller.step === item}
						{#if docsSelected}
							<div class="block-list">
								<h2>Building blocks</h2>
								{#if item.id !== chapter.libraryDocs?.index}<p>{item.caption}</p>{/if}
								<BlockIndex {docs} />
							</div>
						{:else}
							<StepCard step={item} reroll={controller.reroll} disabled={controller.error} />
						{/if}
					{/if}
				</Tabs.Content>
			{/each}
		</div>
	</Tabs.Root>
</main>

<style>
	main {
		--chapter-target: 44px;
		--chapter-stage-height: max(22rem, calc(100svh - var(--chapter-header-height)));
	}
	.anchor {
		position: absolute;
		inset: 0 auto auto 0;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-4);
		border-bottom: var(--hair) solid var(--line);
	}
	h1 {
		font-size: var(--text-l);
		font-weight: 650;
		line-height: 1.2;
		text-wrap: balance;
	}
	.chapter-number,
	.step-number,
	main :global(.chapter-seed) {
		font-size: var(--text-s);
		font-variant-numeric: tabular-nums;
	}
	.chapter-number,
	.step-number,
	.summary {
		color: var(--ink-2);
	}
	.chapter-number {
		margin-bottom: var(--space-1);
	}
	.summary {
		margin-top: var(--space-1);
		text-wrap: pretty;
	}
	main :global(.chapter-seed) {
		white-space: nowrap;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		padding: var(--space-1) var(--space-2);
	}
	main :global(.chapter-body) {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
	}
	.docs-selected {
		--chapter-stage-height: clamp(20rem, 52vh, 34rem);
	}
	.docs-selected :global(.chapter-body) {
		grid-template-columns: minmax(0, 1fr) minmax(28rem, 1fr);
	}
	.block-list {
		padding: var(--space-4);
	}
	.block-list > h2 {
		margin-bottom: var(--space-3);
		font-size: var(--text-l);
		font-weight: 650;
	}
	.block-list > p {
		margin-bottom: var(--space-3);
		color: var(--ink-2);
	}
	.stage-placeholder {
		height: var(--chapter-stage-height);
	}
	main :global(button) {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--chapter-target);
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
		touch-action: manipulation;
	}
	main :global(button:not(:disabled):hover),
	main :global(button[data-state='on']),
	main :global(button[data-state='active']) {
		background: var(--paper-3);
	}
	main :global(button:disabled) {
		color: var(--ink-3);
	}
	main :global(button:focus-visible) {
		z-index: 1;
		outline-offset: -3px;
	}
	.reading {
		min-width: 0;
		border-inline-start: var(--hair) solid var(--line);
		background: var(--paper);
	}
	.reading :global(.steps) {
		display: flex;
		overflow-x: auto;
		border-bottom: var(--hair) solid var(--line);
	}
	.reading :global(.steps button) {
		justify-content: flex-start;
		flex: 1 0 7.5rem;
		max-width: 12rem;
		padding-block: var(--space-2);
		border: 0;
		border-inline-end: var(--hair) solid var(--line);
		text-align: start;
		line-height: 1.2;
	}
	.reading :global(.steps button:last-child) {
		border-inline-end: 0;
	}
	@media (max-width: 760px) {
		main {
			--chapter-stage-height: 55svh;
		}
		header {
			position: relative;
			display: block;
			padding: var(--space-3);
		}
		header .chapter-seed {
			position: absolute;
			top: var(--space-2);
			right: var(--space-3);
		}
		.chapter-number {
			padding-inline-end: 7rem;
		}
		.summary {
			font-size: var(--text-s);
		}
		.docs-selected {
			--chapter-stage-height: 15rem;
		}
		.block-list {
			padding: var(--space-3);
		}
		main :global(.chapter-body),
		.docs-selected :global(.chapter-body) {
			grid-template-columns: minmax(0, 1fr);
		}
		.reading {
			border-inline-start: 0;
		}
		.reading :global(:focus-visible) {
			scroll-margin-top: calc(var(--chapter-stage-height) + var(--space-2));
		}
	}
</style>
