<script lang="ts">
	import Button from '../ui/Button.svelte';
	import { onMount, untrack } from 'svelte';
	import { readPalette } from '../scene/themeBinding';
	import { createParametrikScene } from './parametrik';
	import { defaultStyle, type SceneStyle } from '../logic/parametrik/style';
	import type { Primitive } from '../logic/parametrik/types';
	let {
		primitives,
		label,
		style = defaultStyle,
		tools = true
	}: {
		primitives: Primitive[];
		label: string;
		style?: SceneStyle;
		/** false: no own reset button; the surrounding demo calls reset() (bibel/DemoLayout). */
		tools?: boolean;
	} = $props();
	/** Camera back to the fitted default view. */
	export function reset() {
		scene?.reset();
	}
	let host: HTMLDivElement;
	let canvas = $state<HTMLCanvasElement>();
	let mounted = $state(false),
		error = $state('');
	let cameraState: ReturnType<ReturnType<typeof createParametrikScene>['cameraState']> | undefined;
	let scene = $state<ReturnType<typeof createParametrikScene>>();
	onMount(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				mounted = entry.isIntersecting;
			},
			{ rootMargin: '100px' }
		);
		observer.observe(host);
		return () => observer.disconnect();
	});
	$effect(() => {
		if (!mounted || !canvas) return;
		error = '';
		try {
			const current = createParametrikScene(canvas, readPalette(host), () => {
				error = '3D view unavailable.';
			});
			scene = current;
			if (cameraState) current.restoreCamera(cameraState);
			void current.ready.catch(() => {});
			const resize = () => current.resize(canvas!.clientWidth, canvas!.clientHeight);
			const observer = new ResizeObserver(resize);
			observer.observe(host);
			resize();
			return () => {
				observer.disconnect();
				cameraState = current.cameraState();
				current.dispose();
				untrack(() => {
					scene = undefined;
				});
			};
		} catch (cause) {
			console.error(cause);
			error = '3D view unavailable.';
		}
	});
	$effect(() => {
		const current = scene,
			next = primitives,
			appearance = style;
		const frame = requestAnimationFrame(() => current?.update(next, appearance));
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="view" class:bare={!tools} bind:this={host}>
	<canvas
		bind:this={canvas}
		aria-label={label + '. Drag: rotate; right-drag: pan; mouse wheel: zoom.'}
		tabindex="0"
	></canvas>
	{#if tools}<div class="tools">
			<Button variant="secondary" label="Reset view" onclick={() => scene?.reset()} />
		</div>{/if}
	{#if error}<p role="status">{error}</p>{/if}
</div>

<style>
	.view {
		padding-top: 56px;
		position: relative;
		min-width: 0;
		height: 600px;
		border: var(--hair) solid var(--line);
	}
	.view.bare {
		padding-top: 0;
	}
	.tools {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
	}
	canvas:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	p {
		position: absolute;
		inset: var(--space-4);
	}
	@media (max-width: 720px) {
		.view {
			height: 320px;
		}
	}
</style>
