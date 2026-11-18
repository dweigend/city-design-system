<script lang="ts">
	import { onMount } from 'svelte';
	import { mountPlate } from '../scene/art-reference';
	let { kind, seed }: { kind: 'collage' | 'vessel'; seed: number } = $props();
	let canvas: HTMLCanvasElement;
	let error = $state('');
	let view = $state.raw<ReturnType<typeof mountPlate>>();
	onMount(() => {
		try {
			error = '';
			view = mountPlate(canvas, kind, seed);
			return view.dispose;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Rendering failed';
		}
	});
	$effect(() => view?.update(seed));
</script>

{#if error}<p role="alert">{error}</p>{/if}
<canvas
	bind:this={canvas}
	role="img"
	aria-label={kind === 'collage'
		? 'Pencil stock and a raised insertion on a notched plot'
		: 'Hollow ceramic inlet with an offset neck and a blue lip'}
></canvas>

<style>
	canvas {
		display: block;
		width: 100%;
		height: clamp(220px, 26vw, 340px);
	}
</style>
