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
	import type { GroundPointer } from './ground-pointer';
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
		onGroundPointer?: (pointer: GroundPointer) => void;
		panOnDrag?: boolean;
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
		onViewport,
		onGroundPointer,
		panOnDrag = true
	}: Props = $props();
	let canvas = $state<HTMLCanvasElement>();
	let stage = $state.raw<Awaited<ReturnType<typeof Stage.create>>>();
	let unavailable = $state(false);
	let navigation = $state.raw<ReturnType<typeof stageNavigation>>();
	let interaction = $state.raw<ViewFit>({});
	function combine(value: ViewFit) {
		return {
			...fit,
			zoom: (fit?.zoom ?? 1) * (value.zoom ?? 1),
			offset: [
				(fit?.offset?.[0] ?? 0) + (value.offset?.[0] ?? 0),
				(fit?.offset?.[1] ?? 0) + (value.offset?.[1] ?? 0)
			] as const
		};
	}
	function groundPointer(event: PointerEvent) {
		if (!canvas || !stage || !onGroundPointer) return;
		const { left, top, width, height } = canvas.getBoundingClientRect();
		const ground = stage.pickGround([
			event.clientX - left - width / 2,
			event.clientY - top - height / 2
		]);
		onGroundPointer({ event, ground, canvas });
	}

	const cameraFit = $derived(combine(interaction));

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
			(value) => (interaction = value),
			(value) => {
				const frame = stage?.readFrame(combine(value));
				if (!frame) throw new Error('The stage closed during navigation');
				return frame;
			},
			() => panOnDrag
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
			class:stage-paint={Boolean(onGroundPointer) && !panOnDrag}
			onpointerdown={groundPointer}
			onpointermove={groundPointer}
			onpointerup={groundPointer}
			onpointercancel={groundPointer}
			onlostpointercapture={groundPointer}
			bind:this={canvas}
			aria-label={label}
			tabindex={interactive ? 0 : undefined}
			aria-keyshortcuts={interactive
				? '+ - ArrowUp ArrowDown ArrowLeft ArrowRight Home'
				: undefined}
		></canvas>
	{/if}
</div>
