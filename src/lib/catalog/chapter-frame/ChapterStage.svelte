<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { Layers, Play, RotateCcw, Shuffle, Square, SquareDashed } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type { ChapterPreset } from '../data/chapters';
	import { displayLabels, viewLabels } from '../data/view-modes';
	import { createAcceptanceChapterStage, type ChapterStageFactory } from '../scene/chapter-stage';
	import { createValleyChapterStage } from '../scene/valley';
	import type { ChapterController } from './chapter-controller.svelte';

	let {
		scene,
		controller,
		compact = false
	}: { scene: ChapterPreset['scene']; controller: ChapterController; compact?: boolean } = $props();

	const stages = {
		valley: createValleyChapterStage,
		acceptance: createAcceptanceChapterStage
	} satisfies Record<ChapterPreset['scene'], ChapterStageFactory>;
	const displayIcons = { transparency: SquareDashed, levels: Layers };
	let canvas = $state<HTMLCanvasElement>();
	let picture = $state<HTMLDivElement>();
	let error = $derived(controller.error);
	let step = $derived(controller.step);
	let selection = $derived(controller.selection);

	onMount(() => {
		const host = picture;
		const preset = step?.preset;
		if (!canvas || !host || !preset) return;
		const stage = stages[scene](canvas, controller.reportError, preset.seed);
		controller.attach(stage);
		const resize = () => {
			if (host.clientWidth && host.clientHeight) stage.resize(host.clientWidth, host.clientHeight);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();
		return () => {
			observer.disconnect();
			controller.detach();
			stage.dispose();
		};
	});
</script>

<section class="stage" class:compact aria-label="Chapter stage">
	{#if step && selection}
		{@const { views, display, displays = [display] } = step}
		{#if !compact || views.length > 1 || displays.length > 1}
			<div class="stage-options">
				{#if !compact || views.length > 1}
					<ToggleGroup.Root
						type="single"
						aria-label="View"
						bind:value={() => controller.selection?.view ?? '', controller.selectView}
					>
						{#each Object.entries(viewLabels) as [id, label] (id)}
							{@const allowed = views.some((view) => view === id)}
							{#if !compact || allowed}
								<ToggleGroup.Item value={id} disabled={!allowed}>{label}</ToggleGroup.Item>
							{/if}
						{/each}
					</ToggleGroup.Root>
				{/if}
				{#if !compact || displays.length > 1}
					<ToggleGroup.Root
						type="single"
						aria-label="Display"
						bind:value={() => controller.selection?.display ?? '', controller.selectDisplay}
					>
						{#each Object.entries(displayLabels) as [id, label] (id)}
							{@const allowed = displays.some((mode) => mode === id)}
							{#if !compact || allowed}
								<ToggleGroup.Item value={id} disabled={!allowed} aria-label={label} title={label}>
									{#if id === 'transparency' || id === 'levels'}
										{@const Icon = displayIcons[id]}
										<Icon size={16} aria-hidden="true" />
									{:else}
										{label}
									{/if}
								</ToggleGroup.Item>
							{/if}
						{/each}
					</ToggleGroup.Root>
				{/if}
			</div>
		{/if}

		<div class="stage-picture" bind:this={picture}>
			<div
				class="picture-image"
				role="img"
				aria-label={`${step.title}. ${viewLabels[selection.view]} view, seed ${controller.seed}.`}
			>
				<canvas bind:this={canvas} aria-hidden="true"></canvas>
			</div>
			{#if error}
				<p class="stage-error" role="alert">The scene could not load. Reload to try again.</p>
			{/if}
		</div>

		<div class="stage-bar">
			{#if compact && step.control.kind === 'seed'}
				<button type="button" class="reroll" onclick={controller.reroll} disabled={error}>
					<Shuffle size={16} aria-hidden="true" />
					Reroll seed
				</button>
			{/if}
			{#if !compact || step.control.kind === 'playback'}
				<button
					type="button"
					onclick={controller.play}
					disabled={error || step.control.kind !== 'playback'}
					aria-label={controller.playing ? 'Stop demo' : 'Play demo'}
					title={controller.playing ? 'Stop demo' : 'Play demo'}
				>
					{#if controller.playing}
						<Square size={16} aria-hidden="true" />
					{:else}
						<Play size={16} aria-hidden="true" />
					{/if}
				</button>
			{/if}
			<button
				type="button"
				onclick={controller.reset}
				aria-label="Reset stage"
				title="Reset stage"
				disabled={error}
			>
				<RotateCcw size={16} aria-hidden="true" />
			</button>
			<span class="chapter-seed" aria-live="polite">Seed {controller.seed}</span>
		</div>
	{/if}
</section>

<style>
	.stage {
		display: grid;
		position: sticky;
		z-index: 1;
		top: 0;
		grid-template-rows: auto minmax(0, 1fr) auto;
		height: var(--chapter-stage-height);
		box-sizing: border-box;
		background: var(--paper);
	}
	.compact {
		position: relative;
		z-index: auto;
	}
	.compact .chapter-seed {
		padding-inline: var(--space-2);
		font-size: var(--text-s);
	}
	.stage-picture {
		grid-row: 2;
		position: relative;
		min-width: 0;
	}
	.picture-image,
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.stage-options,
	.stage-bar {
		display: flex;
		flex-wrap: wrap;
		padding: var(--space-2);
	}
	.stage-options {
		gap: var(--space-1) var(--space-2);
		border-bottom: var(--hair) solid var(--line);
	}
	.stage-bar {
		grid-row: 3;
		justify-content: flex-end;
		border-top: var(--hair) solid var(--line);
	}
	.stage-options :global([data-toggle-group-root]) {
		display: flex;
		flex-wrap: wrap;
	}
	.reroll {
		margin-inline-end: auto;
	}
	.stage :global(button) {
		min-width: var(--chapter-target);
	}
	.stage :global(button + button),
	.stage-bar :global(.chapter-seed) {
		margin-inline-start: calc(-1 * var(--hair));
	}
	.stage-bar :global(.chapter-seed) {
		display: grid;
		place-items: center;
	}
	.stage-error {
		position: absolute;
		inset: 50% var(--space-4) auto;
		text-align: center;
	}
	@media (max-width: 760px) {
		.stage {
			border-bottom: var(--hair) solid var(--line);
		}
	}
</style>
