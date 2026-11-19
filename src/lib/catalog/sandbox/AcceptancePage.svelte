<script lang="ts">
	import { resolve } from '$app/paths';
	import { Toggle, ToggleGroup } from 'bits-ui';
	import { Map as MapIcon } from 'lucide-svelte';
	import { loadEnvelopeKernel } from './envelope-kernel';
	import { onMount } from 'svelte';
	import { acceptanceScene } from '../logic/sandbox';
	import { attachInput } from '../scene/sandbox/input';
	import { createSandboxStage, type SandboxStage } from '../scene/sandbox/stage';
	import type { StructureVariant } from '../scene/sandbox/view-params';
	import { ThemeToggle } from '../theme';
	import Icon from '../ui/Icon.svelte';

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let stage = $state.raw<SandboxStage>();
	let plan = $state(false);
	let variant = $state<StructureVariant>('leitstil');
	let error = $state(false);

	onMount(() => {
		const study = acceptanceScene();
		const current = createSandboxStage(canvas, () => (error = true), study);
		void current.ready.catch(() => {});
		const observer = new ResizeObserver(([entry]) => {
			current.resize(entry.contentRect.width, entry.contentRect.height);
		});
		observer.observe(host);
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
			viewChanged: current.render
		});
		stage = current;
		return () => {
			mounted = false;
			detach();
			observer.disconnect();
			current.dispose();
		};
	});

	$effect(() => stage?.setPlan(plan));
	$effect(() => stage?.setStructureVariant(variant));
</script>

<svelte:head><title>Acceptance scene · City Design System</title></svelte:head>

<main>
	<header>
		<div>
			<h1>Acceptance scene</h1>
			<nav aria-label="Sandbox plates">
				<a href={resolve('/sandbox/regel')}>House rule</a>
				<a href={resolve('/sandbox/stile')}>Style study</a>
			</nav>
		</div>
		<div class="controls">
			<ToggleGroup.Root
				type="single"
				value={variant}
				onValueChange={(value) => {
					if (value === 'leitstil' || value === 'hairline') variant = value;
				}}
				aria-label="Structure strokes"
				class="variants"
			>
				<ToggleGroup.Item value="leitstil">Leitstil</ToggleGroup.Item>
				<ToggleGroup.Item value="hairline">Gray hairline</ToggleGroup.Item>
			</ToggleGroup.Root>
			<Toggle.Root
				bind:pressed={plan}
				class="cg-button"
				data-variant="icon"
				aria-label="Plan view"
				title="Plan view"
			>
				<Icon icon={MapIcon} size={20} />
			</Toggle.Root>
			<ThemeToggle />
		</div>
	</header>
	<div class="view" bind:this={host}>
		<canvas
			bind:this={canvas}
			tabindex="0"
			aria-label="Seed 7 acceptance scene. Arrow keys pan, plus and minus zoom."
		></canvas>
		{#if error}<p role="alert">3D view unavailable.</p>{/if}
	</div>
</main>

<style>
	main {
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
	.controls :global(.variants) {
		display: inline-flex;
	}
	.controls :global(.variants > button),
	.controls > :global(.cg-button) {
		display: inline-grid;
		place-items: center;
		min-width: var(--ctl-m);
		min-height: var(--ctl-m);
		padding: 0 var(--space-2);
		border: var(--hair) solid var(--line);
		color: var(--ink);
		background: var(--paper);
		font-size: var(--text-s);
		cursor: pointer;
	}
	.controls :global(.variants > button[data-state='on']),
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
</style>
