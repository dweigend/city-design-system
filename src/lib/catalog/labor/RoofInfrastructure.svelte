<script lang="ts">
	import { onMount } from 'svelte';
	import { mountPlate } from '../scene/megastructure';
	import Button from '../ui/Button.svelte';
	let canvas: HTMLCanvasElement;
	let view = $state<ReturnType<typeof mountPlate>>();
	let error = $state('');
	onMount(() => {
		try {
			view = mountPlate(canvas);
			return () => view?.dispose();
		} catch (e) {
			error = e instanceof Error ? e.message : '3D view unavailable';
		}
	});
</script>

<svelte:head><title>Roof infrastructure · City Design System</title></svelte:head>
<main>
	<header>
		<h1>Roof infrastructure</h1>
		<Button variant="secondary" label="Reset view" onclick={() => view?.reset()} />
	</header>
	<figure>
		<canvas
			tabindex="0"
			bind:this={canvas}
			aria-label="Three existing roofs with a shared space frame, plug-in modules and a hillside stair. Drag to orbit or use the arrow keys to pan"
		></canvas>
		{#if error}<p role="alert">{error}</p>{/if}
		<figcaption>
			Wall bearings · Ceramic capsules · Water tank · Solar ring · Roof garden · Switchback stair
		</figcaption>
	</figure>
</main>

<style>
	main {
		max-width: 1440px;
		margin: auto;
		padding: clamp(16px, 4vw, 56px);
		color: var(--ink);
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		border-bottom: var(--hair) solid var(--line);
		padding-bottom: var(--space-4);
	}
	h1 {
		font-size: clamp(24px, 3vw, 40px);
		font-weight: 500;
		letter-spacing: -0.035em;
		margin: 0;
	}
	canvas:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	figure {
		margin: 0;
	}
	canvas {
		display: block;
		width: 100%;
		height: clamp(300px, 65vh, 680px);
		touch-action: none;
	}
	figcaption {
		border-top: var(--hair) solid var(--line);
		padding-top: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
