<script lang="ts">
	import Button from '../ui/Button.svelte';

	let {
		canvas = $bindable(),
		label,
		reset,
		touch = false
	}: {
		canvas?: HTMLCanvasElement;
		label: string;
		reset?: () => void;
		touch?: boolean;
	} = $props();
</script>

<canvas
	bind:this={canvas}
	class:direct-touch={touch}
	aria-label={label + '. Drag: rotate; right-drag: pan; mouse wheel: zoom.'}
	tabindex="0"
></canvas>
{#if reset}
	<div class="tools">
		<Button variant="secondary" label="Reset view" onclick={reset} />
	</div>
{/if}

<style>
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
	.direct-touch {
		touch-action: none;
	}
</style>
