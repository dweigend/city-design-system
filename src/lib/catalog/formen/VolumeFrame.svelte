<script lang="ts">
	import { createParametrikScene, type View } from '../scene/parametrik';
	import { readPalette } from '../scene/themeBinding';
	import { vector } from '../scene/primitive-geometry';
	import { observeSceneVisibility } from '../scene/scene-visibility.svelte';
	import { volumePhases } from '../logic/formen/volume-study';
	import { volumeStudy } from '../data/volume-study';

	let {
		phase,
		annotated = false,
		label
	}: { phase: number; annotated?: boolean; label: string } = $props();
	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let visible = $state(false);
	let failed = $state(false);
	let points = $state<{ x: number; y: number; endX: number; endY: number }[]>([]);
	observeSceneVisibility(
		() => host,
		'120px',
		(value) => (visible = value)
	);
	$effect(() => {
		if (!visible) return;
		const scene = createParametrikScene(canvas, readPalette(host), () => (failed = true), false);
		failed = false;
		let alive = true;
		const resize = () => {
			const w = canvas.clientWidth,
				h = canvas.clientHeight;
			const view: View = {
				center: [9, 3, annotated ? 4.3 : 4.9],
				eye: [0.48, -1, 0.48],
				span: Math.max(annotated ? 7.8 : 8.25, ((annotated ? 11.6 : 10.5) * h) / w)
			};
			scene.resize(w, h);
			scene.frame(view);
			if (annotated)
				points = volumeStudy.faces.map((face) => {
					const projected = vector([...face.point]).project(scene.camera);
					return {
						x: ((1 + projected.x) * w) / 2,
						y: ((1 - projected.y) * h) / 2,
						endX: w * (face.right ? 0.96 : 0.04),
						endY: face.high ? 21 : h - 12
					};
				});
		};
		const ro = new ResizeObserver(resize);
		void scene.ready
			.then(() => {
				if (!alive) return;
				scene.update(volumePhases[phase]);
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

<div class="frame" class:annotated bind:this={host}>
	<canvas bind:this={canvas} aria-label={label}></canvas>
	{#if annotated && !failed}
		<svg aria-hidden="true">
			{#each points as point, i (i)}
				{@const face = volumeStudy.faces[i]}
				{@const join = point.endX + (face.right ? -1 : 1) * 20}
				<polyline points="{point.x},{point.y} {join},{point.endY} {point.endX},{point.endY}" />
				<circle cx={point.x} cy={point.y} r="2" />
				<text x={point.endX} y={point.endY - 5} text-anchor={face.right ? 'end' : 'start'}
					>{face.name}</text
				>
			{/each}
		</svg>
	{/if}
	{#if failed}<p role="status">3D view unavailable.</p>{/if}
</div>

<style>
	.frame {
		position: relative;
		height: clamp(144px, 21vh, 195px);
	}
	.annotated {
		height: clamp(260px, 45vh, 340px);
	}
	canvas,
	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
	svg,
	p {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	p {
		padding: var(--space-4);
	}
	polyline {
		fill: none;
		stroke: var(--ink-2);
		stroke-width: 1;
	}
	circle,
	text {
		fill: var(--ink);
	}
	text {
		font: 500 var(--text-s) var(--font-sans);
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 3px;
	}
	@media (max-width: 720px) {
		.frame {
			height: clamp(170px, 44vw, 240px);
		}
		.annotated {
			height: clamp(235px, 64vw, 320px);
		}
	}
</style>
