<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		Stage,
		stageNavigation,
		type Display,
		type Presentation,
		type View,
		type ViewFit,
		type Viewport
	} from '../stage';
	import type { Drawable } from '../surface';

	interface Props {
		drawables: readonly Drawable[];
		view: View;
		display: Display;
		label: string;
		landscape?: boolean;
		fit?: ViewFit;
		interactive?: boolean;
		presentation?: Presentation;
		onViewport?: (viewport: Viewport) => void;
	}

	let {
		drawables,
		view,
		display,
		label,
		landscape = false,
		fit,
		interactive = false,
		presentation,
		onViewport
	}: Props = $props();
	let canvas = $state<HTMLCanvasElement>();
	let stage = $state.raw<Awaited<ReturnType<typeof Stage.create>>>();
	let unavailable = $state(false);
	let navigation = $state.raw<ReturnType<typeof stageNavigation>>();
	let interaction = $state.raw<ViewFit>({});
	const cameraFit = $derived({
		...fit,
		zoom: (fit?.zoom ?? 1) * (interaction.zoom ?? 1),
		offset: [
			(fit?.offset?.[0] ?? 0) + (interaction.offset?.[0] ?? 0),
			(fit?.offset?.[1] ?? 0) + (interaction.offset?.[1] ?? 0)
		] as const
	});

	onMount(() => {
		if (!canvas) return;
		const target = canvas;
		let mounted = true;
		let resize: ResizeObserver | undefined;
		void Stage.create({
			canvas: target,
			landscape,
			fit,
			onViewport: (value) => onViewport?.(value)
		}).then(
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

	$effect(() => {
		if (!canvas || !stage || !interactive) return;
		const next = stageNavigation(
			canvas,
			() => stage?.readViewport().metersPerPixel ?? 1,
			(value) => (interaction = value)
		);
		navigation = next;
		return () => next.delete();
	});
	$effect.pre(() => {
		if (fit || view) untrack(() => navigation?.reset());
	});
	$effect(() => stage?.show(drawables, presentation));
	$effect(() => stage?.setView(view));
	$effect(() => stage?.setDisplay(display));
	$effect(() => stage?.setFit(cameraFit));
</script>

<div class="frame">
	{#if unavailable}
		<p class="small" role="status">Use a browser with WebGPU to see this view.</p>
	{:else}
		<canvas
			class:stage-interactive={interactive}
			bind:this={canvas}
			aria-label={label}
			tabindex={interactive ? 0 : undefined}
			aria-keyshortcuts={interactive
				? '+ - ArrowUp ArrowDown ArrowLeft ArrowRight Home'
				: undefined}
		></canvas>
	{/if}
</div>
