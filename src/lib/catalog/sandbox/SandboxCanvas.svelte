<script lang="ts">
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { createCanvasHover } from '../scene/sandbox/canvas-hover';
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
	let hover = $state.raw<ReturnType<typeof createCanvasHover>>();

	onMount(() => {
		const current = createSandboxStage(canvas, () => (error = '3D view unavailable.'));
		void current.ready.catch(() => {});
		const target = createCanvasHover(current, (id) => (hoveredId = id));
		const resize = () => {
			current.resize(host.clientWidth, host.clientHeight);
			target.refresh();
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();
		const detach = attachInput(canvas, current.view, {
			draws: () => session.tool.kind !== 'look',
			hover: target.move,
			strokeStart: (x, y) => {
				const cell = target.cellAt(x, y);
				if (cell) session.strokeStart(cell.id);
			},
			strokeMove: (x, y) => {
				const cell = target.cellAt(x, y);
				if (cell) session.strokeMove(cell.id);
			},
			strokeEnd: () => session.strokeEnd(),
			viewChanged: (position) => {
				current.render();
				if (position) target.move(position);
				else target.refresh();
			}
		});
		stage = current;
		hover = target;
		let mounted = true;
		void loadEnvelopeKernel()
			.then((roofBuilder) => {
				if (mounted) session.setRoofBuilder(roofBuilder);
			})
			.catch(() => {
				if (mounted) error = 'Detailed roofs unavailable.';
			});
		return () => {
			mounted = false;
			detach();
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(() => hover?.show(session.world, session.focus));
	$effect(() => {
		stage?.setPlan(plan);
		hover?.refresh();
	});
	$effect(() => onhover?.(hovered));

	function updateCursor(current: SandboxStage) {
		if (!hovered || session.tool.kind === 'look') {
			current.setLens(0, 0, 0);
			current.setCursor([]);
			return;
		}
		current.setLens(hovered.column + 0.5, hovered.row + 0.5, 1);
		current.setCursor(cursorFrame(session.world.state, session.tool, hovered));
	}

	$effect(() => {
		if (!stage) return;
		if (session.failure) {
			stage.setLens(0, 0, 0);
			stage.setCursor(session.failure.marks, 'hazard');
		} else updateCursor(stage);
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
