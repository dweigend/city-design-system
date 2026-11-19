<script lang="ts">
	import { sandboxMotion } from '../data/sandbox';
	import type { StrokeRelease } from './feedback';

	let {
		response
	}: {
		response?: { kind: StrokeRelease['tool']['kind']; x: number; y: number; width: number };
	} = $props();
</script>

{#if response}
	{#key response}
		<span
			aria-hidden="true"
			class="response"
			class:basin={response.kind === 'dig'}
			style:left="{response.x}px"
			style:top="{response.y}px"
			style:--size="{response.width}px"
			style:--seat="{sandboxMotion.seatMs}ms"
			style:--fill="{sandboxMotion.responseMs}ms"
		></span>
	{/key}
{/if}

<style>
	.response {
		position: absolute;
		pointer-events: none;
		width: var(--size);
		height: var(--size);
		translate: -50% -50%;
		border: var(--stroke) solid var(--blueprint);
		animation: seat var(--seat) ease-out both;
	}
	.basin {
		height: calc(var(--size) * 0.45);
		border-radius: 50%;
		background: color-mix(in srgb, var(--cat-health), transparent 65%);
		animation: fill var(--fill) ease-out both;
	}
	@keyframes seat {
		from {
			opacity: 1;
			transform: translateY(-28%);
		}
		to {
			opacity: 0;
			transform: translateY(0);
		}
	}
	@keyframes fill {
		from {
			transform: scale(0.35);
		}
		70% {
			opacity: 0.65;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.response {
			display: none;
		}
	}
</style>
