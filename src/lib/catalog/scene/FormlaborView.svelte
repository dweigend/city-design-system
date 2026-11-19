<script lang="ts">
	import { observeSceneVisibility, observeSceneSize } from './scene-visibility.svelte';
	import DrawingCanvas from './DrawingCanvas.svelte';
	import { untrack } from 'svelte';
	import { readPalette } from './themeBinding';
	import { createFormlaborScene } from './formlabor';
	import type { Stand } from '../logic/parametrik/formlabor';
	/**
	 * Canvas of the form lab. staende changes instance rows (or only uniforms when only the
	 * position layer moves); bau and explosion are always uniforms only.
	 */
	let {
		staende,
		bau,
		explosion,
		label
	}: { staende: Stand[]; bau: number; explosion: number; label: string } = $props();
	let host: HTMLDivElement;
	let canvas = $state<HTMLCanvasElement>();
	let mounted = $state(false),
		error = $state('');
	let scene = $state<ReturnType<typeof createFormlaborScene>>();
	observeSceneVisibility(
		() => host,
		'100px',
		(visible) => (mounted = visible)
	);
	$effect(() => {
		if (!mounted || !canvas) return;
		const surface = canvas;
		error = '';
		try {
			const current = createFormlaborScene(surface, readPalette(host), () => {
				error = '3D view unavailable.';
			});
			scene = current;
			const stopResize = observeSceneSize(host, surface, current);
			return () => {
				stopResize();
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
			next = staende;
		current?.update({
			staende: next,
			bau: untrack(() => bau),
			explosion: untrack(() => explosion)
		});
	});
	$effect(() => {
		scene?.schau(bau, explosion);
	});
</script>

<div class="view" bind:this={host}>
	<DrawingCanvas bind:canvas {label} touch reset={() => scene?.reset()} />
	{#if error}<p role="status">{error}</p>{/if}
</div>

<style>
	.view {
		position: relative;
		min-width: 0;
		height: 760px;
		border: var(--hair) solid var(--line);
	}
	p {
		position: absolute;
		inset: var(--space-4);
	}
	@media (max-width: 720px) {
		.view {
			height: 460px;
		}
	}
</style>
