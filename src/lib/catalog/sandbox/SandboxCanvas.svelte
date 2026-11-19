<script lang="ts">
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { createCanvasHover } from '../scene/sandbox/canvas-hover';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { attachInput } from '../scene/sandbox/input';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox/stage';
	import type { OpeningArea } from '../scene/sandbox/view';
	import { cursorTarget, previewStrokePlan, strokePreview } from '../logic/sandbox';
	import type { TerrainCell } from '../logic/terrain-grid';
	import type { Session } from './session.svelte';
	import StoreFlight from './StoreFlight.svelte';
	import StrokeResponse from './StrokeResponse.svelte';
	import { placementResponse, type StrokeRelease } from './feedback';

	let {
		session,
		label,
		plan = false,
		openingArea,
		storeTarget,
		transitPaused = false,
		onhover
	}: {
		session: Session;
		label: string;
		/** True shows the plan from above instead of the axonometric view. */
		plan?: boolean;
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
	let releasedPlan = $state.raw<StrokeRelease>();

	const displayedPlan = $derived(session.gesture ? session.previewPlan : releasedPlan);
	const previewWorld = $derived(displayedPlan?.base ?? session.world);
	const previewTool = $derived(displayedPlan?.tool ?? session.tool);
	const hovered = $derived(hoveredId ? previewWorld.grid.cellsById.get(hoveredId) : undefined);
	let hover = $state.raw<ReturnType<typeof createCanvasHover>>();

	function queueFrame(callback: () => void) {
		const id = requestAnimationFrame(() => {
			releaseFrames.delete(id);
			callback();
		});
		releaseFrames.add(id);
	}

	function releaseStroke(releasedAt: number, target: ReturnType<typeof createCanvasHover>) {
		const release = session.strokeRelease();
		if (!release) {
			target.endStroke();
			return;
		}
		releasedPlan = release;
		queueFrame(() => {
			canvas.dataset.responseMs = String(performance.now() - releasedAt);
			queueFrame(() => {
				session.commitRelease(release);
				if (releasedPlan === release) releasedPlan = undefined;
				if (!session.gesture) target.endStroke();
			});
		});
	}

	onMount(() => {
		const current = createSandboxStage(canvas, () => (error = '3D view unavailable.'), {
			openingArea,
			frameTown: true,
			...session.opening
		});
		void current.ready.catch(() => {});
		const target = createCanvasHover(current, (id) => (hoveredId = id));
		const cancelStroke = () => {
			session.strokeCancel();
			target.endStroke();
		};
		const resize = () => {
			cancelStroke();
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
				const picked = target.startStroke({ x, y });
				if (picked) session.strokeStart(picked.world, picked.cell?.id);
			},
			strokeMove: (x, y) => {
				const cell = target.move({ x, y });
				if (cell) session.strokeMove(cell.id);
			},
			strokeEnd: (releasedAt) => releaseStroke(releasedAt, target),
			strokeCancel: cancelStroke,
			viewChanged: (position) => {
				cancelStroke();
				current.viewChanged();
				if (position) target.move(position);
				else target.refresh();
			}
		});
		stage = current;
		hover = target;
		const unsubscribe = session.onCompletion((event) => {
			const next = placementResponse(event, current.view);
			if (next) response = next;
		});
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
			unsubscribe();
			for (const id of releaseFrames) cancelAnimationFrame(id);
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(() => {
		const { world, focus, completion } = session;
		const place = completion?.after.state === world.state && completion.kind !== 'advance';
		hover?.show(world, focus, place);
	});
	$effect(() => {
		if (session.gesture) return;
		stage?.setPlan(plan);
		const area = openingArea?.();
		if (area) stage?.setOpeningArea(area);
		hover?.refresh();
	});
	$effect(() => stage?.setTransitPaused(transitPaused));
	$effect(() => onhover?.(hovered));

	function updateLens(current: SandboxStage) {
		if (hovered) current.setLens(hovered.column + 0.5, hovered.row + 0.5, 1);
		else current.setLens(0, 0, 0);
	}

	const marks = $derived(
		displayedPlan
			? previewStrokePlan(displayedPlan)
			: strokePreview(previewWorld, previewTool, hovered ? [hovered.id] : [])
	);

	function updateCursor(current: SandboxStage) {
		if (previewTool.kind === 'look') {
			current.setLens(0, 0, 0);
			current.setCursor([]);
			return;
		}
		const target = hovered ? cursorTarget(hovered) : [];
		updateLens(current);
		current.setCursor(marks, target);
	}

	$effect(() => {
		if (!stage) return;
		if (session.failure) {
			stage.setLens(0, 0, 0);
			stage.setCursor(session.failure.marks, [], 'hazard');
		} else updateCursor(stage);
	});
</script>

<div class="host" bind:this={host}>
	<canvas bind:this={canvas} tabindex="0" aria-label={label}></canvas>
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
	.error {
		position: absolute;
		inset: 50% auto auto 50%;
		translate: -50% -50%;
		margin: 0;
		color: var(--ink-2);
		font-size: var(--text-s);
	}
</style>
