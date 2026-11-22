<script lang="ts">
	import { onMount } from 'svelte';
	import { Stage, type Display, type View } from '../stage';
	import type { Drawable } from '../surface';

	interface Props {
		drawables: readonly Drawable[];
		view: View;
		display: Display;
		label: string;
	}

	let { drawables, view, display, label }: Props = $props();
	let canvas = $state<HTMLCanvasElement>();
	let stage = $state.raw<Awaited<ReturnType<typeof Stage.create>>>();
	let unavailable = $state(false);

	onMount(() => {
		if (!canvas) return;
		const target = canvas;
		let mounted = true;
		let resize: ResizeObserver | undefined;
		void Stage.create({ canvas: target }).then(
			(opened) => {
				if (!mounted) return opened.delete();
				stage = opened;
				resize = new ResizeObserver(([entry]) => {
					const { width, height } = entry.contentRect;
					opened.resize(width, height);
				});
				resize.observe(target);
			},
			() => {
				if (mounted) unavailable = true;
			}
		);
		return () => {
			mounted = false;
			resize?.disconnect();
			void stage?.delete();
		};
	});

	$effect(() => stage?.show(drawables));
	$effect(() => stage?.setView(view));
	$effect(() => stage?.setDisplay(display));
</script>

<div class="frame">
	{#if unavailable}
		<p class="small" role="status">Use a browser with WebGPU to see this view.</p>
	{:else}
		<canvas bind:this={canvas} aria-label={label}></canvas>
	{/if}
</div>
