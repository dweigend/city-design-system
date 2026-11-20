<script lang="ts">
	import MotionToggle from './MotionToggle.svelte';
	import { resolve } from '$app/paths';
	import { Toggle } from 'bits-ui';
	import { Map as MapIcon } from 'lucide-svelte';
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { onMount } from 'svelte';
	import { acceptanceScene } from '../logic/sandbox';
	import { sandboxUses } from '../data/sandbox';
	import { attachInput } from '../scene/sandbox';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox';
	import { ThemeToggle } from '../theme';
	import Icon from '../ui/Icon.svelte';

	let host: HTMLDivElement;
	let legend: HTMLUListElement;
	let canvas: HTMLCanvasElement;
	let stage = $state.raw<SandboxStage>();
	let seed = $state(7);
	let plan = $state(false);
	let paused = $state(false);
	let error = $state('');
	const key = [...sandboxUses, { id: 'paths', name: 'Paths', color: 'var(--cat-business)' }];

	onMount(() => {
		const query = new URLSearchParams(location.search);
		const requested = Number(query.get('seed') ?? '7');
		seed = Number.isSafeInteger(requested) ? requested >>> 0 : 7;
		const { world, earliestFullYear, additions } = acceptanceScene(seed);
		const openingArea = () => {
			const rect = host.getBoundingClientRect();
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
			return top > 0 && top < rect.height ? { top: 0, bottom: top, reserved } : undefined;
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
	$effect(() => stage?.setPlan(plan));
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
			<Toggle.Root
				bind:pressed={plan}
				class="cg-button"
				data-variant="icon"
				aria-label="Plan view"
				title="Plan view"
			>
				<Icon icon={MapIcon} size={20} />
			</Toggle.Root>
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
	.controls > :global(.cg-button) {
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
	}
	.controls > :global(.cg-button[data-state='on']) {
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
