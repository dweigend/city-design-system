<script lang="ts">
	import { createParametrikScene, type View } from '../scene/parametrik';
	import { readPalette } from '../scene/themeBinding';
	import { observeSceneVisibility } from '../scene/scene-visibility.svelte';
	import { buildStyleHouse, type StyleHouseId } from '../logic/style-house';

	let { house, label }: { house: StyleHouseId; label: string } = $props();
	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let visible = $state(false);
	let failed = $state(false);
	/** World direction toward the camera, shared by the three houses. */
	const EYE: [number, number, number] = [0.8, -1, 0.62];
	const EYE_COSINE = Math.hypot(EYE[0], EYE[1]) / Math.hypot(...EYE);
	const EYE_SINE = EYE[2] / Math.hypot(...EYE);
	/** Depth of the lot toward the camera that the frame keeps, as a share of the lot width. */
	const LOT_REACH = 0.55;
	observeSceneVisibility(
		() => host,
		'160px',
		(value) => (visible = value)
	);
	$effect(() => {
		if (!visible) return;
		const built = buildStyleHouse(house);
		const { width, height } = built.inputs;
		const scene = createParametrikScene(canvas, readPalette(host), () => (failed = true), 'turn');
		failed = false;
		let alive = true;
		// Same camera for every house: the lot's near corner and the top limit stay in frame.
		const view = (w: number, h: number): View => ({
			center: [0, 0, height / 2 - width * 0.06],
			eye: EYE,
			span: Math.max(
				1.04 * ((height / 2) * EYE_COSINE + LOT_REACH * width * EYE_SINE),
				(0.78 * width * h) / w
			)
		});
		const resize = () => {
			const w = canvas.clientWidth,
				h = canvas.clientHeight;
			scene.resize(w, h);
			scene.frame(view(w, h));
		};
		const ro = new ResizeObserver(resize);
		void scene.ready
			.then(() => {
				if (!alive) return;
				scene.update(built.parts);
				resize();
				ro.observe(host);
			})
			.catch(() => {
				if (alive) failed = true;
			});
		return () => {
			alive = false;
			ro.disconnect();
			void scene.dispose();
		};
	});
</script>

<div class="frame" bind:this={host}>
	<canvas bind:this={canvas} aria-label={label}></canvas>
	{#if failed}<p role="status">3D view unavailable.</p>{/if}
</div>

<style>
	.frame {
		position: relative;
		height: clamp(340px, 54vh, 480px);
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
		pointer-events: none;
	}
	@media (max-width: 720px) {
		.frame {
			height: clamp(340px, 104vw, 460px);
		}
	}
</style>
