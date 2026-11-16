<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { readPalette } from '../scene/themeBinding';
	import { createParametrikScene, type GroupOf } from '../scene/parametrik';
	import { rahmen } from '../logic/ansicht/rahmen';
	import type { Bounds } from '../logic/ansicht/geometrie';
	import type { SceneStyle } from '../logic/parametrik/style';
	import type { Primitive, Vec3 } from '../logic/parametrik/types';
	/** One view of the workbench (main, plan or section): fixed frame, groups, selection by click. */
	let {
		primitives,
		style,
		frame,
		eye,
		title,
		note = '',
		label,
		groupOf,
		offsets,
		interactive = false,
		onpick
	}: {
		primitives: Primitive[];
		style: SceneStyle;
		frame: Bounds;
		eye: Vec3;
		title: string;
		note?: string;
		label: string;
		groupOf?: GroupOf;
		offsets?: Map<string, Vec3>;
		interactive?: boolean;
		onpick?: (id: string | undefined) => void;
	} = $props();
	let host: HTMLElement,
		canvas = $state<HTMLCanvasElement>(),
		mounted = $state(false),
		error = $state(''),
		size = $state({ w: 1, h: 1 });
	let scene = $state<ReturnType<typeof createParametrikScene>>();
	const view = $derived(rahmen(frame, eye, size.w / size.h));
	onMount(() => {
		const observer = new IntersectionObserver(([entry]) => (mounted = entry.isIntersecting), {
			rootMargin: '200px'
		});
		observer.observe(host);
		return () => observer.disconnect();
	});
	$effect(() => {
		if (!mounted || !canvas) return;
		error = '';
		try {
			const current = createParametrikScene(
				canvas,
				readPalette(host),
				() => (error = '3D view unavailable.'),
				interactive
			);
			void current.ready.catch(() => {});
			const resize = () => {
				size = { w: canvas!.clientWidth || 1, h: canvas!.clientHeight || 1 };
				current.resize(size.w, size.h);
			};
			const observer = new ResizeObserver(resize);
			observer.observe(host);
			untrack(resize);
			scene = current;
			return () => {
				observer.disconnect();
				current.dispose();
				untrack(() => (scene = undefined));
			};
		} catch {
			error = '3D view unavailable.';
		}
	});
	// Rebuild only on new primitives or a new frame; one frame bundles fast slider moves.
	$effect(() => {
		const current = scene,
			next = primitives,
			look = style,
			g = groupOf;
		const raf = requestAnimationFrame(() =>
			current?.update(
				next,
				look,
				untrack(() => view),
				g
			)
		);
		return () => cancelAnimationFrame(raf);
	});
	$effect(() => {
		const current = scene,
			v = view;
		if (current) untrack(() => current.frame(v));
	});
	$effect(() => {
		const current = scene,
			o = offsets;
		void primitives;
		if (current && o) requestAnimationFrame(() => current.arrange(o));
	});
	/** Camera back to the starting view; its button stands in the controls, never in the image. */
	export function zuruecksetzen() {
		scene?.reset();
	}
	let start = { x: 0, y: 0 };
	function click(e: MouseEvent) {
		if (!scene || !canvas || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
		const r = canvas.getBoundingClientRect();
		onpick?.(
			scene.pick(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2)
		);
	}
</script>

<figure class="view" bind:this={host}>
	<figcaption>
		<span>{title}</span>{#if note}<span class="note">{note}</span>{/if}
	</figcaption>
	<canvas
		bind:this={canvas}
		aria-label={label}
		tabindex="0"
		onpointerdown={(e) => (start = { x: e.clientX, y: e.clientY })}
		onclick={click}
	></canvas>
	{#if error}<p role="status">{error}</p>{/if}
</figure>

<style>
	.view {
		position: relative;
		margin: 0;
		min-width: 0;
		height: 100%;
		border: var(--hair) solid var(--line);
		background: var(--paper);
	}
	figcaption {
		position: absolute;
		top: var(--space-2);
		left: var(--space-3);
		right: var(--space-3);
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink);
		pointer-events: none;
		z-index: 1;
	}
	.note {
		color: var(--ink-2);
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: crosshair;
	}
	canvas:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -3px;
	}
	p {
		position: absolute;
		inset: var(--space-8) var(--space-4);
		font-size: var(--text-s);
	}
</style>
