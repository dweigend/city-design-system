<script lang="ts">
	import { onMount } from 'svelte';
	import { connectionSection, type connectionViews } from '../logic/connection-study';
	import { flowColor } from '../data/focus';
	import { createParametrikScene, type View } from '../scene/parametrik';
	import { vector } from '../scene/primitive-geometry';
	import { readPalette } from '../scene/themeBinding';

	let {
		connection,
		showCaption = true
	}: { connection: (typeof connectionViews)[number]; showCaption?: boolean } = $props();

	const view: View = { center: [0, 1, 3.4], eye: [0.64, -1, 0.83], span: 15 };
	let canvas: HTMLCanvasElement;
	let path = $state('');
	let endpoint = $state<{ x: number; y: number }>();
	let failed = $state(false);

	onMount(() => {
		const scene = createParametrikScene(canvas, readPalette(canvas), () => (failed = true), false);
		let alive = true;
		const resize = () => {
			const width = canvas.clientWidth;
			const height = canvas.clientHeight;
			scene.resize(width, height);
			const points = connection.points.map((point) => {
				const p = vector([...point]).project(scene.camera);
				return { x: ((1 + p.x) * width) / 2, y: ((1 - p.y) * height) / 2 };
			});
			path = points.map(({ x, y }) => `${x},${y}`).join(' ');
			endpoint = points.at(-1);
		};
		const observer = new ResizeObserver(resize);
		void scene.ready
			.then(() => {
				if (!alive) return;
				scene.update(connectionSection, undefined, view);
				resize();
				observer.observe(canvas);
			})
			.catch(() => {
				if (alive) failed = true;
			});
		return () => {
			alive = false;
			observer.disconnect();
			void scene.dispose();
		};
	});
</script>

<figure
	id={showCaption ? connection.id : undefined}
	aria-label={showCaption ? undefined : connection.detail}
>
	<div class="drawing" data-theme="light" style:--flow={flowColor(connection.flow, 5)}>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>
		{#if endpoint}
			<svg aria-hidden="true">
				<rect
					x={endpoint.x - 7}
					y={endpoint.y - 7}
					width="14"
					height="14"
					class:planned={!connection.walkingKind}
				/>
				<polyline points={path} />
				<circle cx={endpoint.x} cy={endpoint.y} r="3.5" />
			</svg>
		{/if}
		{#if failed}<p role="status">3D view unavailable.</p>{/if}
	</div>
	{#if showCaption}
		<figcaption>
			<h3>{connection.title}</h3>
			<span>{connection.detail}</span>
			<span class="status">
				<i class:planned={!connection.walkingKind} aria-hidden="true"></i>
				{connection.walkingKind ? 'Proven' : 'Planned'}
			</span>
		</figcaption>
	{/if}
</figure>

<style>
	figure {
		min-width: 0;
		margin: 0;
	}
	.drawing {
		position: relative;
		aspect-ratio: 1.22;
		border-block-end: var(--hair) solid var(--line);
		background: var(--paper);
	}
	canvas,
	svg {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}
	svg {
		pointer-events: none;
	}
	polyline {
		fill: none;
		stroke: var(--flow);
		stroke-width: 3;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	rect {
		fill: var(--paper);
		fill-opacity: 0.84;
		stroke: var(--ink);
		stroke-width: 1;
	}
	rect.planned {
		stroke-dasharray: 2 2;
	}
	circle {
		fill: var(--flow);
	}
	figcaption {
		display: grid;
		gap: var(--space-1);
		padding-block-start: var(--space-2);
		color: var(--ink-2);
		font-size: var(--text-s);
	}
	h3 {
		color: var(--ink);
		font-size: var(--text-m);
		font-weight: 600;
	}
	.status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	i {
		width: 0.9rem;
		border-top: 1px solid currentColor;
	}
	i.planned {
		border-top-style: dashed;
	}
	p {
		position: absolute;
		inset: var(--space-3);
	}
</style>
