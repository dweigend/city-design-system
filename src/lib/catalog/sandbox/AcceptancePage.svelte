<script lang="ts">
	import MotionToggle from './MotionToggle.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { RadioGroup } from 'bits-ui';
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { onMount } from 'svelte';
	import { acceptanceScene } from '../logic/sandbox';
	import { sandboxUses } from '../data/sandbox';
	import { viewLabels, viewModes, type ViewPolicy } from '../data/view-modes';
	import { resolveView } from '../logic/view-modes';
	import { attachInput } from '../scene/sandbox';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox';
	import { ThemeToggle } from '../theme';

	let host: HTMLDivElement;
	let legend: HTMLUListElement;
	let canvas: HTMLCanvasElement;
	let stage = $state.raw<SandboxStage>();
	let seed = $state(7);
	const viewPolicy = { view: 'iso', views: viewModes, display: 'normal' } satisfies ViewPolicy;
	let selected = $state(resolveView(viewPolicy));
	let paused = $state(false);
	let error = $state('');
	const key = [...sandboxUses, { id: 'paths', name: 'Paths', color: 'var(--cat-business)' }];

	function selectView(value: string) {
		selected = resolveView(viewPolicy, { view: value });
		const url = new URL(location.href);
		url.searchParams.set('view', selected.view);
		void goto(resolve(`/sandbox/abnahme?${url.searchParams}${url.hash}`), {
			shallow: true,
			replace: true,
			state: page.state
		});
	}

	onMount(() => {
		const query = new URLSearchParams(location.search);
		const initialView = viewModes.find((view) => view === query.get('view'));
		selected = resolveView(viewPolicy, { view: initialView });
		const requested = Number(query.get('seed') ?? '7');
		seed = Number.isSafeInteger(requested) ? requested >>> 0 : 7;
		const { world, earliestFullYear, additions, featuredCentre } = acceptanceScene(seed);
		const openingArea = () => {
			const rect = host.getBoundingClientRect();
			if (!rect.height) return;
			const key = legend.getBoundingClientRect();
			const top = key.top - rect.top;
			const reserved = [
				{
					left: key.left - rect.left,
					right: key.right - rect.left,
					top,
					bottom: key.bottom - rect.top
				}
			];
			const bottom = top > 0 && top < rect.height ? top : rect.height;
			return { top: Math.min(32, bottom / 4), bottom, reserved, featuredCentre };
		};
		const study = {
			openingArea,
			world,
			earliestFullYear,
			additions,
			frameTown: true,
			onFrameFailure: (reason: string) => {
				error = 'Frame survey: ' + reason;
			},
			minInkAppliesTo:
				query.get('minInkAppliesTo') === 'primary' ? ('primary' as const) : ('all' as const)
		};
		const current = createSandboxStage(canvas, () => (error = '3D view unavailable.'), study);
		current.setView(selected);
		void current.ready.catch(() => {});
		const observer = new ResizeObserver(() => {
			current.resize(host.clientWidth, host.clientHeight);
		});
		observer.observe(host);
		observer.observe(legend);
		current.resize(host.clientWidth, host.clientHeight);
		current.show(study.world, 'all');
		let mounted = true;
		void loadEnvelopeKernel()
			.then((roofBuilder) => {
				if (mounted) current.show({ ...study.world, roofBuilder }, 'all');
			})
			.catch((cause) => console.warn('Detailed roofs unavailable.', cause));
		const detach = attachInput(canvas, current.view, {
			draws: () => false,
			hover: () => {},
			strokeStart: () => {},
			strokeMove: () => {},
			strokeEnd: () => {},
			viewChanged: current.viewChanged
		});
		stage = current;
		return () => {
			mounted = false;
			detach();
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(() => stage?.setPaused(paused));
	$effect(() => stage?.setView(selected));
</script>

<svelte:head><title>Acceptance scene · City Design System</title></svelte:head>

<main>
	<header>
		<div>
			<a class="brand" href={resolve('/')}>City Design System</a>
			<h1>Riverside town</h1>
			<nav aria-label="Sandbox plates">
				<a href={resolve('/sandbox')}>Open in sandbox</a>
				<a href={resolve('/sandbox/regel')}>House rule</a>
				<a href={resolve('/sandbox/stile')}>Style study</a>
			</nav>
		</div>
		<div class="controls">
			<RadioGroup.Root
				value={selected.view}
				onValueChange={selectView}
				aria-label="View mode"
				class="view-modes"
			>
				{#each viewPolicy.views as view (view)}
					<RadioGroup.Item value={view} class="view-mode">{viewLabels[view]}</RadioGroup.Item>
				{/each}
			</RadioGroup.Root>
			<MotionToggle bind:paused />
			<ThemeToggle />
		</div>
	</header>
	<div class="view" bind:this={host}>
		<canvas
			bind:this={canvas}
			tabindex="0"
			aria-label="Seed {seed} acceptance scene. Arrow keys pan, plus and minus zoom."
		></canvas>

		{#if error}<p role="alert">{error}</p>{/if}
	</div>
	<ul bind:this={legend} class="key" aria-label="Colour key">
		{#each key as item (item.id)}
			<li><span class="chip" style:--chip={item.color}></span>{item.name}</li>
		{/each}
		<li><span class="chip stock"></span>Stock</li>
	</ul>
</main>

<style>
	main {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-4);
		border-bottom: var(--hair) solid var(--line);
	}
	h1 {
		margin: 0;
		font-size: var(--text-l);
		font-weight: 600;
	}
	.brand {
		color: var(--ink-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs, 0.6875rem);
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.key {
		position: absolute;
		inset: auto auto var(--space-3) var(--space-3);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		max-width: calc(100% - 2 * var(--space-3));
		margin: 0;
		padding: var(--space-2) var(--space-3);
		list-style: none;
		border: var(--hair) solid var(--line);
		background: var(--paper);
		font-family: var(--font-mono);
		font-size: var(--text-xs, 0.6875rem);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.key li {
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}
	.chip {
		width: 0.75rem;
		height: 0.75rem;
		border: var(--hair) solid var(--ink);
		border-radius: 50%;
		background: var(--chip);
	}
	.chip.stock {
		border-color: var(--ink-3);
		background: var(--paper);
	}
	nav,
	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	nav {
		color: var(--ink-2);
		font-size: var(--text-s);
	}
	nav a {
		color: inherit;
	}
	.controls {
		flex-wrap: wrap;
	}
	.controls :global(.view-modes) {
		display: flex;
	}
	.controls > :global(.cg-button),
	.controls :global(.view-mode) {
		display: inline-grid;
		place-items: center;
		min-width: max(44px, var(--ctl-m));
		min-height: max(44px, var(--ctl-m));
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--line);
		color: var(--ink);
		background: var(--paper);
		font-size: var(--text-s);
		cursor: pointer;
		touch-action: manipulation;
	}
	.controls :global(.view-mode + .view-mode) {
		border-inline-start: 0;
	}
	.controls :global(.view-mode:hover) {
		background: var(--paper-2);
	}
	.controls :global(.view-mode:focus-visible) {
		outline-offset: -2px;
	}
	.controls > :global(.cg-button[data-state='on']),
	.controls :global(.view-mode[data-state='checked']) {
		background: var(--paper-3);
	}
	.view {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	canvas:focus-visible {
		outline-offset: -2px;
	}
	p {
		position: absolute;
		inset: 50% 0 auto;
		margin: 0;
		text-align: center;
	}
	@media (max-width: 640px) {
		.key {
			position: static;
			max-width: none;
			border-width: var(--hair) 0 0;
		}
	}
</style>
