<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { blockDemos } from './block-demos';
	import { createChapterController } from './chapter-controller.svelte';
	import ChapterStage from './ChapterStage.svelte';

	let { example }: { example: string } = $props();
	const demo = $derived(blockDemos[example]);
	const controller = createChapterController(() => [demo.step], {
		resolveSelection: (policy, request) => demo.resolve?.(policy, request),
		standalone: true
	});
	const measurement = $derived(
		controller.seed === undefined ? undefined : demo.measurement?.(controller.seed)
	);

	afterNavigate(controller.syncLocation);
</script>

{#if controller.step}
	<ChapterStage scene={demo.step.preset.scene} {controller} compact />
	{#if measurement}<output>{measurement}</output>{/if}
{:else}
	<div class="placeholder" aria-hidden="true"></div>
{/if}

<style>
	.placeholder {
		height: var(--chapter-stage-height);
		background: var(--paper-2);
	}
	output {
		display: block;
		padding: var(--space-2);
		border-top: var(--hair) solid var(--line);
		font-size: var(--text-s);
		font-variant-numeric: tabular-nums;
	}
</style>
