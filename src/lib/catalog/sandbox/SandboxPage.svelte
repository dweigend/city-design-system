<script lang="ts">
	import { Toggle } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import { Map as MapIcon, Pause, Play, Volume2, VolumeX } from 'lucide-svelte';
	import { resolve } from '$app/paths';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import { ThemeToggle } from '../theme';
	import { sandboxMethods, sandboxTools, sandboxUses, sandboxZones } from '../data/sandbox';
	import type { TerrainCell } from '../logic/terrain-grid';
	import SandboxCanvas from './SandboxCanvas.svelte';
	import SandboxHud from './SandboxHud.svelte';
	import { createSession } from './session.svelte';
	import { createSandboxSound } from './sound';

	/**
	 * The city sandbox as a full page: the terrain fills the window, a sparse HUD floats on
	 * top. Starts with a small old town; the terrain comes from the seed.
	 */
	const session = createSession(7);
	let hud = $state<SandboxHud>();
	let hovered = $state.raw<TerrainCell>();
	let plan = $state(false);
	let header = $state<HTMLElement>();
	let hudGroup = $state<HTMLDivElement>();

	function openingArea() {
		if (!header || !hudGroup) return;
		const top = header.getBoundingClientRect().bottom;
		const bottom = hudGroup.getBoundingClientRect().top;
		if (top < bottom) return { top, bottom };
	}
	let storeTarget = $state<HTMLElement>();
	let muted = $state(false);
	let transitPaused = $state(false);
	const sound = createSandboxSound();
	$effect(() => sound.dispose);
	$effect(() => {
		if (session.completion) sound.play(session.completion);
	});
	const showsShortcuts = new MediaQuery('(any-hover: hover) and (any-pointer: fine)');

	const store = $derived(
		sandboxUses
			.map((use) => ({ ...use, count: session.world.state.store[use.id] }))
			.filter((entry) => entry.count > 0)
	);

	function history(event: KeyboardEvent, key: string) {
		if (key !== 'z') return;
		event.preventDefault();
		if (event.shiftKey) session.redo();
		else session.undo();
	}
	const commands = new Map<string, () => void>([
		['f', session.cycleFocus],
		['y', session.advance],
		['p', () => (plan = !plan)],
		...sandboxTools.map(({ shortcut, id }): [string, () => void] => [
			shortcut.toLowerCase(),
			() => hud?.pickTool(id)
		]),
		...sandboxUses.map((_, index): [string, () => void] => [
			String(index + 1),
			() => hud?.pickOption(index)
		])
	]);
	function pick(key: string) {
		const command = commands.get(key);
		if (command) return command();
		const method = session.methods.find((id) => sandboxMethods[id].shortcut.toLowerCase() === key);
		if (method) session.pickMethod(method);
	}
	function pickOnce(event: KeyboardEvent, key: string) {
		if (!event.repeat) pick(key);
	}
	function shortcut(event: KeyboardEvent) {
		const key = event.key.toLowerCase();
		if (event.ctrlKey || event.metaKey) history(event, key);
		else if (!event.altKey) pickOnce(event, key);
	}
</script>

<svelte:head><title>Sandbox · City Design System</title></svelte:head>
<svelte:window
	onpointerdown={sound.unlock}
	onpointerup={sound.unlock}
	onkeydown={(event) => {
		sound.unlock();
		shortcut(event);
	}}
/>
<main>
	<SandboxCanvas
		{session}
		{plan}
		{openingArea}
		{storeTarget}
		{transitPaused}
		label={showsShortcuts.current
			? 'City sandbox. Arrow keys move the view, plus and minus zoom.'
			: 'City sandbox. Pinch to zoom, drag with two fingers to move.'}
		onhover={(cell) => (hovered = cell)}
	/>
	<header bind:this={header}>
		<a class="brand" href={resolve('/')}>City Design System</a>
		<h1>Sandbox</h1>
		<p class="readout" aria-live="polite">
			{#if hovered}
				{sandboxZones[hovered.zone]} · {Math.round(hovered.center[2])} m
			{:else}
				Terrain {session.world.seed}
			{/if}
		</p>
		<dl class="store" aria-label="Material store" aria-live="polite">
			<dt bind:this={storeTarget}>Store</dt>
			{#each store as entry (entry.id)}
				<dd><span class="dot" style:--dot={entry.color}></span>{entry.count} {entry.name}</dd>
			{:else}
				<dd>0</dd>
			{/each}
		</dl>
		<div class="time">
			<Button
				variant="secondary"
				label={'Focus · ' + session.focus}
				shortcut="F"
				onclick={session.cycleFocus}
			/>
		</div>
	</header>
	<div class="mode">
		<Toggle.Root
			bind:pressed={plan}
			class="cg-button"
			data-variant="icon"
			aria-label="Plan view"
			aria-keyshortcuts={showsShortcuts.current ? 'P' : undefined}
			title={showsShortcuts.current ? 'Plan view (P)' : 'Plan view'}
		>
			<Icon icon={MapIcon} size={24} />
		</Toggle.Root>
		<Toggle.Root
			pressed={muted}
			onPressedChange={(next) => {
				muted = next;
				sound.setMuted(next);
			}}
			class="cg-button"
			data-variant="icon"
			aria-label="Mute sound"
			title="Mute sound"
		>
			<Icon icon={muted ? VolumeX : Volume2} size={24} />
		</Toggle.Root>
		{#if session.world.lines.length}
			<Toggle.Root
				bind:pressed={transitPaused}
				class="cg-button"
				data-variant="icon"
				aria-label="Pause vehicles"
				title="Pause vehicles"
			>
				<Icon icon={transitPaused ? Play : Pause} size={24} />
			</Toggle.Root>
		{/if}
		<ThemeToggle />
	</div>
	<SandboxHud bind:this={hud} bind:group={hudGroup} {session} />
</main>

<style>
	main {
		--sandbox-target: max(44px, var(--ctl-m));
		--steuer-knopf: var(--sandbox-target);
		position: fixed;
		inset: 0;
		overflow: hidden;
	}
	header {
		position: absolute;
		top: var(--space-2);
		left: var(--space-2);
		display: grid;
		padding: var(--space-2);
		background: var(--paper);
		gap: var(--space-1);
		pointer-events: none;
	}
	.brand {
		color: var(--ink-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-decoration: none;
		text-transform: uppercase;
		pointer-events: auto;
	}
	h1 {
		margin: 0;
		font-size: var(--text-l);
		font-weight: 600;
		line-height: 1.1;
	}
	.readout,
	.store {
		margin: 0;
		color: var(--ink-2);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.store {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
		margin-top: var(--space-2);
	}
	.store dt {
		color: var(--ink);
		font-weight: 600;
	}
	.store dd {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin: 0;
	}
	.dot {
		width: var(--space-2);
		height: var(--space-2);
		border: var(--hair) solid var(--ink);
		border-radius: 50%;
		background: var(--dot);
	}
	.time {
		margin-top: var(--space-2);
		pointer-events: auto;
		display: grid;
		justify-items: start;
		gap: var(--space-1);
	}
	.mode {
		position: absolute;
		top: var(--space-4);
		right: var(--space-4);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.mode :global(.cg-theme-item) {
		width: var(--sandbox-target);
		height: var(--sandbox-target);
	}
	.mode > :global(*) {
		background: var(--paper);
	}
	.mode :global(.cg-button[data-state='on']) {
		background: var(--paper);
		color: var(--ink);
		box-shadow: inset 0 calc(-1 * var(--stroke)) var(--signal);
	}
	@media (max-width: 640px) {
		.mode {
			top: var(--space-2);
			right: var(--space-2);
			display: flex;
			flex-wrap: wrap;
			justify-content: end;
			max-width: calc(3 * var(--sandbox-target) + 2 * var(--space-1) + 2 * var(--hair));
			gap: var(--space-1);
		}
		.mode :global(.cg-theme) {
			margin-left: auto;
		}
		.brand {
			display: inline-flex;
			align-items: center;
			min-height: var(--sandbox-target);
		}
	}
</style>
