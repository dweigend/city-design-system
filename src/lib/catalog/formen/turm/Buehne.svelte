<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { readPalette } from '../../scene/themeBinding';
	import { createParametrikScene, type GroupOf, type View } from '../../scene/parametrik';
	import { bildpunkt } from '../../scene/projektion';
	import { defaultStyle, type SceneStyle } from '../../logic/parametrik/style';
	import type { Primitive, Vec3 } from '../../logic/parametrik/types';

	/**
	 * Stage of the Forms demos: one three.js scene (scene/parametrik, theme via themeBinding),
	 * fixed camera, group offsets for motion without rebuilding, a click reports the id.
	 * The scene lives only while the stage is near the viewport (one WebGL context per stage).
	 */
	let {
		primitives,
		label,
		style = defaultStyle,
		view,
		groupOf,
		offsets,
		drehbar = true,
		verhaeltnis = '4 / 3',
		onpick,
		marken
	}: {
		primitives: Primitive[];
		label: string;
		style?: SceneStyle;
		view?: View;
		groupOf?: GroupOf;
		/** Offset per group in meters (x, y, z). */
		offsets?: Map<string, Vec3>;
		/** Drag rotates, scroll wheel zooms. Off: the image stands still (explainer loops). */
		drehbar?: boolean;
		verhaeltnis?: string;
		onpick?: (id: string | undefined) => void;
		/** HTML above the image; `ort` converts a world point into pixels. */
		marken?: Snippet<[(p: Vec3) => { x: number; y: number; sichtbar: boolean }]>;
	} = $props();

	let host: HTMLDivElement;
	let canvas = $state<HTMLCanvasElement>();
	let nah = $state(false),
		fehler = $state(''),
		breite = $state(1),
		hoehe = $state(1),
		bild = $state(0);
	let scene = $state<ReturnType<typeof createParametrikScene>>();

	/** Camera back to the starting view. */
	export function reset() {
		scene?.reset();
	}

	onMount(() => {
		const io = new IntersectionObserver(([e]) => (nah = e.isIntersecting), {
			rootMargin: '200px'
		});
		io.observe(host);
		return () => io.disconnect();
	});

	$effect(() => {
		if (!nah || !canvas) return;
		const c = canvas;
		fehler = '';
		try {
			const current = createParametrikScene(
				c,
				readPalette(host),
				() => (fehler = '3D view unavailable.'),
				drehbar
			);
			scene = current;
			void current.ready.catch(() => {});
			const resize = () => {
				breite = c.clientWidth || 1;
				hoehe = c.clientHeight || 1;
				current.resize(breite, hoehe);
				untrack(() => bild++);
			};
			const ro = new ResizeObserver(resize);
			ro.observe(host);
			resize();
			return () => {
				ro.disconnect();
				current.dispose();
				untrack(() => (scene = undefined));
			};
		} catch (cause) {
			console.error(cause);
			fehler = '3D view unavailable.';
		}
	});

	$effect(() => {
		const current = scene;
		if (!current) return;
		current.update(primitives, style, view, groupOf);
		const o = untrack(() => offsets);
		if (o) current.arrange(o);
		untrack(() => bild++);
	});

	$effect(() => {
		if (scene && offsets) scene.arrange(offsets);
	});

	// Labels follow the camera; bild counts rebuilds and size changes.
	const ort = $derived.by(() => {
		void bild;
		void offsets;
		const current = scene;
		return (p: Vec3) =>
			current ? bildpunkt(current.camera, p, breite, hoehe) : { x: 0, y: 0, sichtbar: false };
	});

	let start: [number, number] | undefined;
	function down(e: PointerEvent) {
		start = [e.clientX, e.clientY];
	}
	function up(e: PointerEvent) {
		if (!onpick || !start || !scene || !canvas) return;
		const moved = Math.hypot(e.clientX - start[0], e.clientY - start[1]);
		start = undefined;
		if (moved > 5) return;
		const r = canvas.getBoundingClientRect();
		onpick(
			scene.pick(
				((e.clientX - r.left) / r.width) * 2 - 1,
				-((e.clientY - r.top) / r.height) * 2 + 1
			)
		);
	}
</script>

<div class="buehne" bind:this={host} style:aspect-ratio={verhaeltnis}>
	<canvas
		bind:this={canvas}
		tabindex="0"
		class:drehbar
		aria-label={drehbar ? `${label}. Drag to rotate, scroll wheel zooms.` : label}
		onpointerdown={down}
		onpointerup={up}
	></canvas>
	{#if marken && scene}<div class="marken">{@render marken(ort)}</div>{/if}
	{#if fehler}<p role="status">{fehler}</p>{/if}
</div>

<style>
	.buehne {
		position: relative;
		width: 100%;
		min-width: 0;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	canvas.drehbar {
		touch-action: none;
	}
	canvas:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	.marken {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	p {
		position: absolute;
		inset: var(--space-4);
		font-size: var(--text-s);
		color: var(--ink-2);
	}
</style>
