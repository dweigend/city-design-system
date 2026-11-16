<script lang="ts">
	import Button from '../ui/Button.svelte';
	import { onMount, untrack } from 'svelte';
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
		const surface = canvas;
		error = '';
		try {
			const current = createFormlaborScene(surface, readPalette(host), () => {
				error = '3D view unavailable.';
			});
			scene = current;
			void current.ready.catch(() => {});
			const resize = () => current.resize(surface.clientWidth, surface.clientHeight);
			const observer = new ResizeObserver(resize);
			observer.observe(host);
			resize();
			return () => {
				observer.disconnect();
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
	<canvas
		bind:this={canvas}
		aria-label={label + '. Drag: rotate; right-drag: pan; mouse wheel: zoom.'}
		tabindex="0"
	></canvas>
	<div class="tools">
		<Button variant="secondary" label="Reset view" onclick={() => scene?.reset()} />
	</div>
	{#if error}<p role="status">{error}</p>{/if}
</div>

<style>
	.view {
		position: relative;
		min-width: 0;
		height: 760px;
		border: var(--hair) solid var(--line);
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
		touch-action: none;
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
