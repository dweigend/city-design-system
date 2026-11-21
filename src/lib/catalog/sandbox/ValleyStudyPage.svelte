<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { VALLEY_PICTURE_SEEDS } from '../data/valley-references';
	import { createSandboxStage } from '../scene/sandbox';
	import { createValleyContext } from '../scene/valley';
	import {
		VALLEY_STUDY_GRID,
		VALLEY_STUDY_SCALE_M,
		VALLEY_STUDY_VIEW,
		valleyStudyField
	} from './valley-study';

	let canvas: HTMLCanvasElement;
	let deck: HTMLDivElement;
	let error = $state(false);
	const scalePercent =
		(100 * VALLEY_STUDY_SCALE_M) / (VALLEY_STUDY_GRID.windowM * VALLEY_STUDY_VIEW.margin);

	onMount(() => {
		const fields = VALLEY_PICTURE_SEEDS.map(valleyStudyField);
		const valley = createValleyContext(fields, VALLEY_STUDY_VIEW);
		const stage = createSandboxStage(canvas, () => (error = true), { context: valley.context });
		void stage.ready.catch(() => {});

		const resize = () => {
			const frame = deck.getBoundingClientRect();
			const width = deck.clientWidth;
			const height = deck.clientHeight;
			if (!width || !height) return;
			const plates = [...deck.querySelectorAll('.plate')].map((element) => {
				const plate = element.getBoundingClientRect();
				return {
					x: plate.left - frame.left + plate.width / 2,
					y: plate.top - frame.top + plate.height / 2,
					width: plate.width
				};
			});
			valley.layout(width, height, plates);
			stage.resize(width, height);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(deck);
		resize();
		return () => {
			observer.disconnect();
			stage.dispose();
		};
	});
</script>

<svelte:head><title>River valleys · Sandbox</title></svelte:head>

<main>
	<header>
		<a href={resolve('/sandbox')}>Sandbox</a>
		<h1>River valleys</h1>
		<p>
			2 × 2&nbsp;km · Flow top to bottom · {VALLEY_STUDY_VIEW.exaggeration}× vertical · 1 / 5&nbsp;m
			contours
		</p>
		{#if error}<p role="alert">Terrain view unavailable. Reload to retry.</p>{/if}
	</header>
	<div class="plates" bind:this={deck}>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>
		{#each VALLEY_PICTURE_SEEDS as seed (seed)}
			<figure>
				<div
					class="plate"
					role="img"
					aria-label="Seed {seed}, a river between two terraced banks"
				></div>
				<figcaption style:--scale-width="{scalePercent}%">
					<strong>Seed {seed}</strong>
					<span class="scale-bar" aria-hidden="true"></span>
					<span class="scale-label">{VALLEY_STUDY_SCALE_M}&nbsp;m</span>
				</figcaption>
			</figure>
		{/each}
	</div>
</main>

<style>
	main {
		max-width: 84rem;
		margin-inline: auto;
		padding: var(--space-4) var(--space-4) var(--space-6);
	}
	header {
		display: grid;
		gap: var(--space-1);
		justify-items: start;
		margin-bottom: var(--space-4);
	}
	a,
	p {
		font-size: var(--text-s);
		color: var(--ink-2);
	}
	a:hover {
		color: var(--ink);
	}
	h1 {
		margin: 0;
		font-size: var(--text-l);
	}
	p {
		margin: 0;
	}
	.plates {
		display: grid;
		position: relative;
		isolation: isolate;
		gap: var(--space-4);
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	canvas {
		position: absolute;
		z-index: -1;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	figure {
		min-width: 0;
		margin: 0;
	}
	.plate {
		aspect-ratio: 1.72;
	}
	figcaption {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--scale-width) auto;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
		color: var(--ink);
		font-size: var(--text-s);
		font-variant-numeric: tabular-nums;
	}
	.scale-bar {
		height: var(--hair);
		background: var(--ink-2);
	}
	.scale-label {
		color: var(--ink-2);
		white-space: nowrap;
	}
	@media (max-width: 720px) {
		main {
			padding-bottom: var(--space-2);
		}
		.plates {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-2);
		}
	}
</style>
