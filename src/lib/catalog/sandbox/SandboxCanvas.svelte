<script lang="ts">
	import { onMount } from 'svelte';
	import { attachInput } from '../scene/sandbox/input';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox/stage';
	import { cursorFrame } from '../logic/sandbox';
	import type { TerrainCell } from '../logic/terrain-grid';
	import type { Session } from './session.svelte';

	let {
		session,
		label,
		plan = false,
		onhover
	}: {
		session: Session;
		label: string;
		/** True shows the plan from above instead of the axonometric view. */
		plan?: boolean;
		onhover?: (cell: TerrainCell | undefined) => void;
	} = $props();
	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let stage = $state.raw<SandboxStage>();
	/** Id of the cell under the pointer; the cell itself is read from the current grid. */
	let hoveredId = $state<string>();
	let error = $state('');

	const hovered = $derived(hoveredId ? session.world.grid.cellsById.get(hoveredId) : undefined);
	const cellAt = (x: number, y: number) => {
		const index = stage?.pickCell(x, y);
		return index === undefined ? undefined : session.world.grid.cells[index];
	};

	onMount(() => {
		const current = createSandboxStage(canvas, () => (error = '3D view unavailable.'));
		void current.ready.catch(() => {});
		const resize = () => current.resize(host.clientWidth, host.clientHeight);
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();
		const detach = attachInput(canvas, current.view, {
			draws: () => session.tool.kind !== 'look',
			hover: (position) => (hoveredId = position && cellAt(position.x, position.y)?.id),
			strokeStart: (x, y) => {
				const cell = cellAt(x, y);
				if (cell) session.strokeStart(cell.id);
			},
			strokeMove: (x, y) => {
				const cell = cellAt(x, y);
				if (cell) session.strokeMove(cell.id);
			},
			strokeEnd: () => session.strokeEnd(),
			viewChanged: () => current.render()
		});
		stage = current;
		return () => {
			detach();
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(() => stage?.show(session.world));
	$effect(() => stage?.setPlan(plan));
	$effect(() => onhover?.(hovered));

	$effect(() => {
		if (!stage) return;
		if (!hovered || session.tool.kind === 'look') {
			stage.setLens(0, 0, 0);
			stage.setCursor([]);
			return;
		}
		stage.setLens(hovered.column + 0.5, hovered.row + 0.5, 1);
		const tone = session.tool.kind === 'erase' ? 'ink' : 'signal';
		stage.setCursor(cursorFrame(session.world.state, session.tool, hovered), tone);
	});
</script>

<div class="host" bind:this={host}>
	<canvas bind:this={canvas} tabindex="0" aria-label={label}></canvas>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
	.host {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--paper);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	.error {
		position: absolute;
		inset: 50% auto auto 50%;
		translate: -50% -50%;
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-s);
	}
</style>
