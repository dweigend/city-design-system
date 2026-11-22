<script lang="ts">
	import { createHouseCourtExample } from '../logic/house-court-example';
	import { resolveView } from '../logic/view-modes';
	import { createHouseCourtContext } from '../scene/house-court';
	import { createSandboxStage } from '../scene/sandbox';
	import { observeSceneSize, observeSceneVisibility } from '../scene/scene-visibility.svelte';

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let visible = $state(false);
	let failure = $state('');

	observeSceneVisibility(
		() => host,
		'0px',
		(value) => (visible = value)
	);

	function createContext() {
		try {
			const { deck, house } = createHouseCourtExample();
			return createHouseCourtContext(deck, house);
		} catch (error) {
			if (!(error instanceof RangeError)) throw error;
			failure = error.message;
		}
	}

	$effect(() => {
		if (!visible) return;
		failure = '';
		const context = createContext();
		if (!context) return;
		const stage = createSandboxStage(
			canvas,
			() => (failure = '3D view unavailable. Reload to retry.'),
			{ context }
		);
		stage.setView(resolveView({ view: 'iso', views: ['iso'], display: 'normal' }));
		stage.setTime(0);
		const stopResize = observeSceneSize(host, canvas, stage);
		return () => {
			stopResize();
			stage.dispose();
		};
	});
</script>

<div class="frame" bind:this={host}>
	<canvas bind:this={canvas} aria-label="View into the open court of a U-shaped house"></canvas>
	{#if failure}<p role="status">{failure}</p>{/if}
</div>

<style>
	.frame {
		position: relative;
		height: clamp(300px, 62vh, 440px);
		min-width: 0;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	p {
		position: absolute;
		inset: 0;
		padding: var(--space-4);
	}
	@media (max-width: 720px) {
		.frame {
			height: clamp(235px, 72vw, 360px);
		}
	}
</style>
