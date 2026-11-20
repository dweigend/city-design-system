<script lang="ts">
	import { observeSceneVisibility, observeSceneSize } from './scene-visibility.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import { readPalette } from '../scene/themeBinding';
	import { createParametrikScene } from './parametrik';
	import { defaultStyle, type SceneStyle } from '../logic/parametrik/style';
	import type { Primitive } from '../logic/parametrik/types';
	let {
		primitives,
		label,
		style = defaultStyle,
		tools = true,
		rulePlate = false
	}: {
		primitives: Primitive[];
		label: string;
		style?: SceneStyle;
		/** false: no own reset button; the surrounding demo calls reset() (bibel/DemoLayout). */
		tools?: boolean;
		rulePlate?: boolean;
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
	observeSceneVisibility(
		() => host,
		'100px',
		(visible) => (mounted = visible)
	);
	$effect(() => {
		if (!mounted || !canvas) return;
		error = '';
		try {
			const current = createParametrikScene(canvas, readPalette(host), () => {
				error = '3D view unavailable.';
			});
			scene = current;
			if (cameraState) current.restoreCamera(cameraState);
			const stopResize = observeSceneSize(host, canvas, current);
			return () => {
				stopResize();
				cameraState = current.cameraState();
				current.dispose();
				scene = undefined;
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
		const plate = rulePlate;
		const frame = requestAnimationFrame(() => {
			if (plate) current?.updateRulePlate(next, appearance);
			else current?.update(next, appearance);
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="view" class:bare={!tools} bind:this={host}>
	<DrawingCanvas bind:canvas {label} reset={tools ? reset : undefined} />
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
