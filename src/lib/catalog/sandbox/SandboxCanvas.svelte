<script lang="ts">
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { connectKernel } from './connect-kernel';
	import { scheduleStrokeRelease } from './stroke-frames';
	import { createCanvasHover } from '../scene/sandbox/canvas-hover';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { attachInput } from '../scene/sandbox/input';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox/stage';
	import type { OpeningArea } from '../scene/sandbox/view';
	import { cursorTarget, tracePreview } from '../logic/sandbox';
	import type { Vec3 } from '../logic/parametrik/types';
	import type { TerrainCell } from '../logic/terrain-grid';
	import type { Session } from './session.svelte';
	import StoreFlight from './StoreFlight.svelte';
	import StrokeResponse from './StrokeResponse.svelte';
	import { placementResponse } from './feedback';

	let {
		session,
		label,
		openingArea,
		storeTarget,
		transitPaused = false,
		onhover
	}: {
		session: Session;
		label: string;
		openingArea?: () => OpeningArea | undefined;
		storeTarget?: HTMLElement;
		transitPaused?: boolean;
		onhover?: (cell: TerrainCell | undefined) => void;
	} = $props();
	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let stage = $state.raw<SandboxStage>();
	/** Id of the cell under the pointer; the cell itself is read from the current grid. */
	let hoveredId = $state<string>();
	let error = $state('');
	let response = $state.raw<ReturnType<typeof placementResponse>>();
	const releaseFrames = new SvelteSet<number>();
	let releasedMarks = $state.raw<Vec3[][]>();
	let touch = $state.raw<{ x: number; y: number }>();
	const hovered = $derived(hoveredId ? session.world.grid.cellsById.get(hoveredId) : undefined);
	let hover = $state.raw<ReturnType<typeof createCanvasHover>>();

	function queueFrame(callback: () => void) {
		const id = requestAnimationFrame(() => {
			releaseFrames.delete(id);
			callback();
		});
		releaseFrames.add(id);
	}

	function showCurrent() {
		const { world, focus, completion } = session;
		const place = completion?.after.state === world.state && completion.kind !== 'advance';
		stage?.setPlan(session.plan);
		hover?.show(world, focus, place);
	}

	function releaseStroke(releasedAt: number) {
		const release = session.strokeRelease();
		if (!release) return;
		scheduleStrokeRelease(session, release, {
			frame: queueFrame,
			acknowledge: () => (canvas.dataset.responseMs = String(performance.now() - releasedAt)),
			preview: (marks) => (releasedMarks = marks),
			finish: () => {
				releasedMarks = undefined;
				showCurrent();
			}
		});
	}

	onMount(() => {
		const current: SandboxStage = createSandboxStage(
			canvas,
			() => (error = '3D view unavailable.'),
			{
				onFrameFailure:reason=>{error=reason;},
				openingArea,
				frameTown: true,
				...session.opening
			}
		);
		void current.ready.catch(() => {});
		const target = createCanvasHover(current, (id) => (hoveredId = id));
		let width = 0;
		let height = 0;
		const resize = () => {
			const { clientWidth, clientHeight } = host;
			if (width === clientWidth && height === clientHeight) return;
			width = clientWidth;
			height = clientHeight;
			session.input(() => {
				session.strokeCancel();
				current.resize(clientWidth, clientHeight);
			});
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();
		const detach = attachInput(canvas, current.view, {
			dispatch: (run) =>
				session.input(() => {
					showCurrent();
					run();
				}),
			pointerFeedback: (position) => (touch = position),
			draws: () => session.tool.kind !== 'look',
			hover: target.move,
			strokeStart: (x, y) => {
				current.endOpening();
				session.strokeStart(target.move({ x, y })?.id);
			},
			strokeMove: (x, y) => {
				const cell = target.move({ x, y });
				if (cell) session.strokeMove(cell.id);
			},
			strokeEnd: releaseStroke,
			strokeCancel: session.strokeCancel,
			viewChanged: (position) => {
				current.viewChanged();
				if (position) target.move(position);
			}
		});
		stage = current;
		hover = target;
		const unsubscribe = session.onCompletion((event) => {
			const next = placementResponse(event, current.view);
			if (next) response = next;
			showCurrent();
		});
		let mounted = true;
		void connectKernel(
			loadEnvelopeKernel,
			() => mounted,
			session.setRoofBuilder,
			session.reportKernelFailure
		);
		return () => {
			mounted = false;
			detach();
			target.dispose();
			session.disposeInput();
			unsubscribe();
			for (const id of releaseFrames) cancelAnimationFrame(id);
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(showCurrent);
	$effect(() => {
		if (session.gesture) return;
		const area = openingArea?.();
		if (area) stage?.setOpeningArea(area);
	});
	$effect(() => stage?.setTransitPaused(transitPaused));
	$effect(() => onhover?.(hovered));

	function updateLens(current: SandboxStage) {
		if (hovered) current.setLens(hovered.column + 0.5, hovered.row + 0.5, 1);
		else current.setLens(0, 0, 0);
	}

	const marks = $derived(
		releasedMarks ??
			tracePreview(
				session.world,
				session.tool,
				session.gesture?.cellIds ?? (hovered ? [hovered.id] : [])
			)
	);

	function updateCursor(current: SandboxStage) {
		if (session.tool.kind === 'look') {
			current.setLens(0, 0, 0);
			current.setCursor([]);
			return;
		}
		const target = hovered ? cursorTarget(hovered) : [];
		updateLens(current);
		current.setCursor(marks, target);
	}

	$effect(() => {
		if (stage) updateCursor(stage);
	});
	$effect(() => stage?.setRejection(session.failure?.marks ?? []));
</script>

<div class="host" bind:this={host}>
	<canvas bind:this={canvas} tabindex="0" aria-label={label}></canvas>
	{#if touch}
		{#key touch}
			<span class="touch" aria-hidden="true" style:left="{touch.x}px" style:top="{touch.y}px"
			></span>
		{/key}
	{/if}
	<StrokeResponse {response} />
	<StoreFlight
		onCompletion={session.onCompletion}
		destination={storeTarget}
		project={(point) => stage?.view.project(point)}
	/>
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
		user-select: none;
	}
	canvas:focus-visible {
		outline-offset: -2px;
	}
	.touch {
		position: absolute;
		pointer-events: none;
		width: var(--space-4);
		height: var(--space-4);
		translate: -50% -50%;
		border: var(--stroke) solid var(--blueprint);
		border-radius: 50%;
		animation: touch 180ms steps(1, end) forwards;
	}
	@keyframes touch {
		to {
			opacity: 0;
		}
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
