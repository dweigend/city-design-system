<script lang="ts">
	import { Collapsible, Popover, Tabs, ToggleGroup } from 'bits-ui';
	import { ChevronDown, Layers, Play, RotateCcw, Square, SquareDashed } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { Chapter, ChapterStep } from '../data/chapters';
	import { designPrinciples } from '../data/design-principles';
	import { resolveView, type ResolvedView } from '../logic/view-modes';
	import type { ChapterStage, ChapterStageFactory } from '../scene/chapter-stage';

	let {
		chapter,
		createStage,
		navigateToStep
	}: {
		chapter: Chapter;
		createStage: ChapterStageFactory;
		navigateToStep: (id: ChapterStep['id']) => void;
	} = $props();

	const viewOptions = [
		{ id: 'iso', label: 'Iso' },
		{ id: 'plan', label: 'Plan' },
		{ id: 'schematic', label: 'Schematic' },
		{ id: 'section', label: 'Section' },
		{ id: 'terrain', label: 'Terrain' }
	] as const;
	const moveMs = 480;
	const byId = new Map(designPrinciples.map((principle) => [principle.id, principle]));

	let stepId = $state<string>();
	let step = $derived(chapter.steps.find((item) => item.id === stepId) ?? chapter.steps[0]);
	let preview = $state<ResolvedView>();
	let seedOverride = $state<number>();
	let view = $derived(preview ?? resolveView(step));
	let seed = $derived(seedOverride ?? step.preset.seed);
	let playing = $state(false);
	let error = $state(false);

	let canvas: HTMLCanvasElement;
	let stageBox: HTMLDivElement;
	let stage: ChapterStage | undefined;
	let timers: ReturnType<typeof setTimeout>[] = [];

	function cancelPlayback() {
		for (const timer of timers) clearTimeout(timer);
		timers = [];
		playing = false;
	}

	function applyView(request: { view?: string; display?: string }, durationMs: number) {
		preview = resolveView(step, request);
		stage?.setView(preview, durationMs);
	}

	function showSeed(nextSeed: number) {
		seedOverride = nextSeed;
		stage?.show({ ...step.preset, seed: nextSeed });
	}

	function showStep(next: ChapterStep, durationMs: number) {
		cancelPlayback();
		stepId = next.id;
		seedOverride = undefined;
		preview = undefined;
		stage?.show(next.preset);
		stage?.reveal();
		stage?.setView(resolveView(next), durationMs);
	}

	function reset() {
		showStep(step, moveMs);
	}

	function selectStep(id: string) {
		const next = chapter.steps.find((item) => item.id === id);
		if (!next || next.id === step.id) return;
		showStep(next, moveMs);
		navigateToStep(next.id);
	}

	function syncHash() {
		const next = chapter.steps.find((item) => '#' + item.id === location.hash) ?? chapter.steps[0];
		if (next.id !== step.id) showStep(next, moveMs);
	}

	function selectView(id: string) {
		if (!id || id === view.view) return;
		if (playing) reset();
		applyView({ view: id }, moveMs);
	}

	function selectDisplay(id: string) {
		if (id && id !== view.display) applyView({ view: view.view, display: id }, 0);
	}

	function reroll(seeds: readonly [number, ...number[]]) {
		showSeed(seeds[(seeds.indexOf(seed) + 1) % seeds.length]);
	}

	function togglePlayback() {
		const control = step.control;
		if (control.kind !== 'playback') return;
		if (playing) return reset();
		playing = true;
		control.cues.forEach((cue, index) => {
			const play = () => {
				stage?.reveal(cue.phase);
				if (cue.view) applyView({ view: cue.view }, moveMs);
				if (index === control.cues.length - 1) cancelPlayback();
			};
			if (cue.atMs === 0) play();
			else timers.push(setTimeout(play, cue.atMs));
		});
	}

	onMount(() => {
		stage = createStage(canvas, () => (error = true));
		const next = chapter.steps.find((item) => '#' + item.id === location.hash) ?? chapter.steps[0];
		showStep(next, 0);
		const resize = () => {
			if (stageBox.clientWidth && stageBox.clientHeight)
				stage?.resize(stageBox.clientWidth, stageBox.clientHeight);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(stageBox);
		resize();
		return () => {
			cancelPlayback();
			observer.disconnect();
			stage?.dispose();
			stage = undefined;
		};
	});
</script>

<svelte:head><title>{chapter.title} · City Design System</title></svelte:head>
<svelte:window onhashchange={syncHash} onpopstate={syncHash} />

<main>
	{#each chapter.steps as item (item.id)}
		<span class="anchor" id={item.id}></span>
	{/each}

	<header>
		<div>
			<p class="chapter-number">Chapter {chapter.number}</p>
			<h1>{chapter.title}</h1>
			<p class="summary">{chapter.summary}</p>
		</div>
		<span class="seed">Seed {seed}</span>
	</header>

	<Tabs.Root value={step.id} onValueChange={selectStep} class="chapter-body">
		<div class="stage" bind:this={stageBox}>
			<div class="stage-picture" role="img" aria-label={chapter.title + ' scene'}>
				<canvas bind:this={canvas} aria-hidden="true"></canvas>
			</div>
			<div class="stage-options">
				<ToggleGroup.Root type="single" aria-label="View" bind:value={() => view.view, selectView}>
					{#each viewOptions as option (option.id)}
						<ToggleGroup.Item
							value={option.id}
							disabled={!step.views.some((id) => id === option.id)}
						>
							{option.label}
						</ToggleGroup.Item>
					{/each}
				</ToggleGroup.Root>
				<ToggleGroup.Root
					type="single"
					aria-label="Display"
					bind:value={() => view.display, selectDisplay}
				>
					<ToggleGroup.Item value="normal" aria-label="Normal display" title="Normal display">
						Normal
					</ToggleGroup.Item>
					<ToggleGroup.Item
						value="transparency"
						disabled
						aria-label="Transparency"
						title="Transparency"
					>
						<SquareDashed size={16} aria-hidden="true" />
					</ToggleGroup.Item>
					<ToggleGroup.Item value="levels" disabled aria-label="Levels" title="Levels">
						<Layers size={16} aria-hidden="true" />
					</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>
			{#if error}<p class="stage-error" role="alert">
					The scene could not load. Reload to try again.
				</p>{/if}
			<div class="stage-bar">
				<button
					type="button"
					onclick={togglePlayback}
					disabled={error || step.control.kind !== 'playback'}
					aria-label={playing ? 'Stop demo' : 'Play demo'}
					title={playing ? 'Stop demo' : 'Play demo'}
				>
					{#if playing}<Square size={16} aria-hidden="true" />{:else}<Play
							size={16}
							aria-hidden="true"
						/>{/if}
				</button>
				<button
					type="button"
					onclick={reset}
					aria-label="Reset stage"
					title="Reset stage"
					disabled={error}
				>
					<RotateCcw size={16} aria-hidden="true" />
				</button>
				<span class="seed" aria-live="polite">Seed {seed}</span>
			</div>
		</div>

		<div class="reading">
			<Tabs.List aria-label="Chapter steps" class="steps">
				{#each chapter.steps as item, index (item.id)}
					<Tabs.Trigger value={item.id}>
						<span class="step-number">{index}</span>
						<span>{item.title}</span>
					</Tabs.Trigger>
				{/each}
			</Tabs.List>

			{#each chapter.steps as item (item.id)}
				<Tabs.Content value={item.id} class="step-card">
					{#if step.id === item.id}
						<h2>{item.title}</h2>
						<p class="caption">{item.caption}</p>
						<div class="step-control">
							{#if item.control.kind === 'seed'}
								{@const seeds = item.control.seeds}
								<button type="button" onclick={() => reroll(seeds)} disabled={error}>
									Reroll seed
								</button>
							{/if}
							<p>{item.control.hint}</p>
						</div>
						<div class="principles">
							{#each item.principles as id (id)}
								{@const principle = byId.get(id)}
								{#if principle}
									<Popover.Root>
										<Popover.Trigger>{principle.id} · {principle.title}</Popover.Trigger>
										<Popover.Portal>
											<Popover.Content
												class="chapter-principle"
												role="dialog"
												aria-label={principle.title}
												sideOffset={6}
												collisionPadding={12}
												trapFocus={false}
											>
												<p>{principle.rule}</p>
												<p>{principle.reason}</p>
											</Popover.Content>
										</Popover.Portal>
									</Popover.Root>
								{/if}
							{/each}
						</div>
						<Collapsible.Root class="details">
							<Collapsible.Trigger>
								{item.details.label}
								<ChevronDown size={16} aria-hidden="true" />
							</Collapsible.Trigger>
							<Collapsible.Content>
								<p>{item.details.text}</p>
							</Collapsible.Content>
						</Collapsible.Root>
					{/if}
				</Tabs.Content>
			{/each}
		</div>
	</Tabs.Root>
</main>

<style>
	main {
		--target: 44px;
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
	h1,
	h2 {
		font-size: var(--text-l);
		font-weight: 650;
		line-height: 1.2;
		text-wrap: balance;
	}
	.chapter-number,
	.step-number,
	.seed {
		font-size: var(--text-s);
		font-variant-numeric: tabular-nums;
	}
	.chapter-number,
	.step-number,
	.summary,
	.step-control p {
		color: var(--ink-2);
	}
	.chapter-number {
		margin-bottom: var(--space-1);
	}
	.summary {
		margin-top: var(--space-1);
		text-wrap: pretty;
	}
	.seed {
		white-space: nowrap;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		padding: var(--space-1) var(--space-2);
	}
	main :global(.chapter-body) {
		display: grid;
		grid-template-columns: 2fr minmax(0, 1fr);
	}
	.stage {
		position: sticky;
		z-index: 1;
		top: 0;
		height: calc(100svh - 110px);
		min-height: 410px;
		background: var(--paper);
	}
	.stage-picture,
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.stage-options,
	.stage-bar {
		position: absolute;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
	}
	.stage-options {
		inset: var(--space-2) var(--space-2) auto;
	}
	.stage-bar {
		inset: auto var(--space-2) var(--space-2) auto;
		gap: 0;
	}
	.stage-options :global([data-toggle-group-root]) {
		display: flex;
	}
	main :global(button) {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--target);
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
	.stage :global(button) {
		min-width: var(--target);
	}
	.stage :global(button + button),
	.stage-bar .seed {
		margin-inline-start: calc(-1 * var(--hair));
	}
	.stage-bar .seed {
		display: grid;
		place-items: center;
	}
	.stage-error {
		position: absolute;
		inset: 50% var(--space-4) auto;
		text-align: center;
	}
	.reading {
		min-width: 0;
		border-inline-start: var(--hair) solid var(--line);
		background: var(--paper);
	}
	.reading :global(.steps) {
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		border-bottom: var(--hair) solid var(--line);
	}
	.reading :global(.steps button) {
		justify-content: flex-start;
		min-width: 0;
		padding-block: var(--space-2);
		border: 0;
		border-inline-end: var(--hair) solid var(--line);
		text-align: start;
		line-height: 1.2;
	}
	.reading :global(.steps button:last-child) {
		border-inline-end: 0;
	}
	.reading :global(.step-card:not([hidden])) {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-4);
	}
	.caption {
		max-width: 34ch;
		text-wrap: pretty;
	}
	.step-control {
		display: grid;
		justify-items: start;
		gap: var(--space-1);
		font-size: var(--text-s);
	}
	.principles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	:global(.chapter-principle) {
		z-index: 2;
		display: grid;
		gap: var(--space-2);
		box-sizing: border-box;
		width: min(320px, calc(100vw - 24px));
		max-height: var(--bits-popover-content-available-height);
		overflow: auto;
		padding: var(--space-3);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		color: var(--ink);
		font-size: var(--text-s);
	}
	.reading :global(.details) {
		border-top: var(--hair) solid var(--line);
		font-size: var(--text-s);
	}
	.reading :global(.details button) {
		justify-content: space-between;
		width: 100%;
		padding-inline: 0;
		border: 0;
		text-align: start;
	}
	.reading :global(.details button[data-state='open'] svg) {
		transform: rotate(180deg);
	}
	.reading :global(.details p) {
		color: var(--ink-2);
	}
	@media (max-width: 760px) {
		header {
			position: relative;
			display: block;
			padding: var(--space-3);
		}
		header .seed {
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
		main :global(.chapter-body) {
			grid-template-columns: minmax(0, 1fr);
		}
		.stage {
			height: 55svh;
			min-height: 0;
			border-bottom: var(--hair) solid var(--line);
		}
		.reading {
			border-inline-start: 0;
			scroll-margin-top: 55svh;
		}
		.reading :global(.step-card:not([hidden])) {
			padding: var(--space-4) var(--space-3);
		}
		.reading :global(:focus-visible) {
			scroll-margin-top: calc(55svh + var(--space-2));
		}
	}
</style>
