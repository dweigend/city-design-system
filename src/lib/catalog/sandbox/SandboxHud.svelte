<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { Dices, Eraser, Hand, House, Redo2, Route, Shovel, Trees, Undo2 } from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import {
		sandboxCovers,
		sandboxLines,
		sandboxTools,
		sandboxUses,
		type SandboxOption,
		type SandboxToolId
	} from '../data/sandbox';
	import type { Tool } from '../logic/sandbox';
	import SandboxOptions from './SandboxOptions.svelte';
	import type { Session } from './session.svelte';

	/**
	 * Tools of the sandbox: one tool bar, the options of the active tool beside it, undo and a
	 * new terrain below. Thin: it only sets the session's tool and calls its actions.
	 */
	let { session }: { session: Session } = $props();

	const icons = { look: Hand, house: House, line: Route, cover: Trees, dig: Shovel, erase: Eraser };
	/** Last option per tool, so switching tools keeps the player's choice. */
	let chosen = $state({
		house: sandboxUses[0].id,
		line: sandboxLines[0].id,
		cover: sandboxCovers[0].id
	});

	const options = $derived.by((): SandboxOption<string>[] => {
		if (session.tool.kind === 'house') return sandboxUses;
		if (session.tool.kind === 'line') return sandboxLines;
		return session.tool.kind === 'cover' ? sandboxCovers : [];
	});
	const option = $derived.by(() => {
		const tool = session.tool;
		if (tool.kind === 'house') return tool.use;
		if (tool.kind === 'line') return tool.transit;
		return tool.kind === 'cover' ? tool.cover : '';
	});
	const active = $derived(sandboxTools.find((tool) => tool.id === session.tool.kind));

	function toolOf(id: SandboxToolId): Tool {
		if (id === 'house') return { kind: 'house', use: chosen.house };
		if (id === 'line') return { kind: 'line', transit: chosen.line };
		if (id === 'cover') return { kind: 'cover', cover: chosen.cover };
		return { kind: id };
	}
	/** Sets the tool by its id; the public entry for buttons and shortcuts. */
	export function pickTool(id: SandboxToolId) {
		session.tool = toolOf(id);
	}
	/** Sets option n (0-based) of the active tool, if it has that many. */
	export function pickOption(index: number) {
		const kind = session.tool.kind;
		if (kind === 'house') chosen.house = sandboxUses[index]?.id ?? chosen.house;
		if (kind === 'line') chosen.line = sandboxLines[index]?.id ?? chosen.line;
		if (kind === 'cover') chosen.cover = sandboxCovers[index]?.id ?? chosen.cover;
		session.tool = toolOf(kind);
	}
</script>

<div class="hud">
	<ToggleGroup.Root
		type="single"
		orientation="vertical"
		value={session.tool.kind}
		onValueChange={(value) => value && pickTool(value as SandboxToolId)}
		class="cg-sandbox-tools"
		aria-label="Tool"
	>
		{#each sandboxTools as tool (tool.id)}
			<ToggleGroup.Item
				value={tool.id}
				class="cg-button"
				data-variant="icon"
				aria-label={tool.name}
				aria-keyshortcuts={tool.shortcut}
				title="{tool.name} ({tool.shortcut})"
			>
				<Icon icon={icons[tool.id]} size={24} />
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	{#if options.length}
		<div class="options">
			<SandboxOptions label="{active?.name} options" {options} value={option} onpick={pickOption} />
		</div>
	{/if}

	<div class="history">
		<Button
			variant="icon"
			label="Undo"
			shortcut="Control+Z"
			disabled={!session.canUndo}
			onclick={session.undo}
		>
			{#snippet icon()}<Icon icon={Undo2} size={24} />{/snippet}
		</Button>
		<Button
			variant="icon"
			label="Redo"
			shortcut="Control+Shift+Z"
			disabled={!session.canRedo}
			onclick={session.redo}
		>
			{#snippet icon()}<Icon icon={Redo2} size={24} />{/snippet}
		</Button>
		<Button
			variant="icon"
			label="New terrain"
			onclick={() => session.restart(session.world.seed + 1)}
		>
			{#snippet icon()}<Icon icon={Dices} size={24} />{/snippet}
		</Button>
	</div>
</div>
{#if active}<p class="hint">{active.hint}</p>{/if}

<style>
	.hud {
		position: absolute;
		top: 50%;
		right: var(--space-4);
		translate: 0 -50%;
		display: grid;
		grid-template-columns: auto var(--ctl-m);
		grid-template-areas: 'options tools' '. history';
		align-items: start;
		gap: var(--space-4) var(--space-2);
		pointer-events: none;
	}
	.hud > :global(*) {
		pointer-events: auto;
	}
	:global(.cg-sandbox-tools),
	.history {
		display: grid;
		gap: 0;
		background: var(--paper);
	}
	:global(.cg-sandbox-tools) {
		grid-area: tools;
	}
	.options {
		grid-area: options;
	}
	.history {
		grid-area: history;
	}
	/* Stacked icon buttons share their hairline. */
	:global(.cg-sandbox-tools > .cg-button + .cg-button),
	.history > :global(.cg-button + .cg-button) {
		margin-top: calc(-1 * var(--hair));
	}
	.hint {
		position: absolute;
		left: 50%;
		bottom: var(--space-4);
		translate: -50% 0;
		max-width: calc(100% - var(--space-8));
		margin: 0;
		padding: var(--space-1) var(--space-3);
		background: var(--paper);
		color: var(--ink-2);
		font-size: var(--text-s);
		text-align: center;
		pointer-events: none;
	}
	/* Narrow screens: the tools lie along the bottom edge, options above them. */
	@media (max-width: 640px) {
		.hud {
			top: auto;
			right: var(--space-2);
			left: var(--space-2);
			bottom: var(--space-2);
			translate: none;
			grid-template-columns: 1fr auto;
			grid-template-areas: 'options options' 'tools history';
			align-items: end;
		}
		:global(.cg-sandbox-tools),
		.history {
			grid-auto-flow: column;
			justify-content: start;
		}
		:global(.cg-sandbox-tools > .cg-button + .cg-button),
		.history > :global(.cg-button + .cg-button) {
			margin-top: 0;
			margin-left: calc(-1 * var(--hair));
		}
		.hint {
			top: var(--space-16);
			bottom: auto;
		}
	}
</style>
