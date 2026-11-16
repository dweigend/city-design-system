<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { createBuehne, type Buehne, type Rahmen } from '../scene/stadt/buehne';
	import type { Kiste, Vec3 } from '../logic/stadt/kiste';

	/**
	 * Canvas for a City building block. Shows what `kisten` currently delivers, reports visibility
	 * (for the clock) and the target under the pointer. `overlay` lies above the image and receives a
	 * model → pixel projection so labels stand in place.
	 */
	let {
		kisten,
		rahmen,
		label,
		ratio = '4 / 3',
		hover = $bindable<string | undefined>(undefined),
		visible = $bindable(false),
		onpick,
		overlay,
		schleier = 0
	}: {
		kisten: readonly Kiste[];
		rahmen: Rahmen;
		label: string;
		ratio?: string;
		hover?: string;
		visible?: boolean;
		onpick?: (target: string | undefined) => void;
		overlay?: Snippet<[(p: Vec3) => { x: number; y: number }, number]>;
		/** Paper veil over image and overlay, 0–1: hides the seam of a loop. */
		schleier?: number;
	} = $props();

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let buehne = $state<Buehne>();
	let fehler = $state('');
	/** Counts size changes so overlays project again. */
	let groesse = $state(0);

	onMount(() => {
		try {
			buehne = createBuehne(canvas, rahmen);
		} catch (cause) {
			console.error(cause);
			fehler = '3D view unavailable.';
			return;
		}
		const current = buehne;
		const resize = () => {
			current.resize(canvas.clientWidth, canvas.clientHeight);
			groesse++;
		};
		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();
		const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
		io.observe(host);
		return () => {
			io.disconnect();
			ro.disconnect();
			current.dispose();
			buehne = undefined;
		};
	});

	$effect(() => {
		buehne?.show(kisten);
	});
	$effect(() => {
		buehne?.setRahmen(rahmen);
		untrack(() => groesse++);
	});

	const at = (e: MouseEvent) => {
		const r = canvas.getBoundingClientRect();
		return buehne?.pick(e.clientX - r.left, e.clientY - r.top);
	};
	const project = (p: Vec3) => {
		void groesse;
		return buehne?.project(p) ?? { x: 0, y: 0 };
	};
</script>

<div class="buehne" bind:this={host} style:--ratio={ratio}>
	<canvas
		bind:this={canvas}
		aria-label={label}
		class:zeigt={!!hover && !!onpick}
		onpointermove={(e) => {
			if (e.pointerType === 'mouse') hover = at(e);
		}}
		onpointerleave={() => (hover = undefined)}
		onclick={(e) => {
			const t = at(e);
			hover = t;
			onpick?.(t);
		}}
	></canvas>
	{#if overlay && buehne}<div class="overlay">{@render overlay(project, groesse)}</div>{/if}
	{#if schleier > 0}<div class="schleier" style:opacity={schleier} aria-hidden="true"></div>{/if}
	{#if fehler}<p class="fehler" role="status">{fehler}</p>{/if}
</div>

<style>
	.buehne {
		position: relative;
		background: var(--paper);
		border: var(--hair) solid var(--line);
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		aspect-ratio: var(--ratio);
		touch-action: manipulation;
	}
	canvas.zeigt {
		cursor: pointer;
	}
	.overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.schleier {
		position: absolute;
		inset: 0;
		background: var(--paper);
		pointer-events: none;
	}
	.fehler {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
