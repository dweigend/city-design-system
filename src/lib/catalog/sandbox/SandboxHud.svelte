<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import { flows } from '../data/focus';
	import { hudZeit } from '../data/interface';
	import { Timeline } from '../interface';
	import { Dices, Eraser, Hand, House, Redo2, Route, Shovel, Trees, Undo2 } from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import {
		sandboxCovers,
		sandboxLines,
		sandboxMethods,
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

	const narrow = new MediaQuery('(max-width: 640px)');
	const methods = $derived(
		session.methods.map((id) => ({ id, ...sandboxMethods[id] })).sort((a, b) => a.phase - b.phase)
	);
	const { year, timeLayers } = $derived(session.world.state);
	const events = $derived(
		timeLayers.map(({ year, flows: layerFlows }) => ({
			year,
			flows: layerFlows,
			label: flows
				.filter(({ id }) => layerFlows.includes(id))
				.map(({ name }) => name)
				.join(', ')
		}))
	);
	const firstYear = $derived(Math.min(year, timeLayers[0]?.year ?? hudZeit.min));

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
	function optionAt<Id extends string>(options: SandboxOption<Id>[], index: number, fallback: Id) {
		return options[index]?.id ?? fallback;
	}
	/** Sets option n (0-based) of the active tool, if it has that many. */
	export function pickOption(index: number) {
		const kind = session.tool.kind;
		if (kind === 'house') chosen.house = optionAt(sandboxUses, index, chosen.house);
		if (kind === 'line') chosen.line = optionAt(sandboxLines, index, chosen.line);
		if (kind === 'cover') chosen.cover = optionAt(sandboxCovers, index, chosen.cover);
		session.tool = toolOf(kind);
	}
</script>

<div class="hud-group">
	<div class="hud">
		<ToggleGroup.Root
			type="single"
			orientation={narrow.current ? 'horizontal' : 'vertical'}
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
				<SandboxOptions
					label={session.tool.kind === 'house' ? 'House use' : `${active?.name} options`}
					horizontal={narrow.current}
					{options}
					value={option}
					onpick={pickOption}
				/>
				{#if session.tool.kind === 'house'}
					<SandboxOptions
						label="Building method"
						options={methods}
						value={session.method}
						horizontal
						compact
						onpick={(index) => {
							const method = methods[index];
							if (method) session.pickMethod(method.id);
						}}
					/>
				{/if}
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
	<div class="timeline" role="group" aria-label="Timeline">
		<div class="scale" class:without-events={!events.length}>
			<Timeline
				{year}
				{events}
				min={firstYear}
				max={Math.max(hudZeit.min + (hudZeit.max - hudZeit.min) * 2, year + hudZeit.major)}
				labelEvery={false}
			/>
		</div>
		<output aria-label="World year">{year}</output>
		<Button variant="secondary" label="Advance" shortcut="Y" onclick={session.advance} />
	</div>
	{#if active}<p class="hint">{active.hint}</p>{/if}
</div>

<style>
	.hud-group {
		display: contents;
	}
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
	:global(.cg-sandbox-tools > .cg-button[data-state='on']) {
		background: var(--paper);
		color: var(--ink);
		box-shadow: inset 0 calc(-1 * var(--stroke)) var(--signal);
	}
	.options {
		grid-area: options;
		display: grid;
		gap: var(--space-2);
	}
	@media (min-width: 641px) {
		.options > :global(.cg-sandbox-options:not([data-compact])) {
			justify-self: end;
		}
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
		right: var(--space-4);
		bottom: var(--space-4);
		max-width: 38vw;
		margin: 0;
		padding: var(--space-1) var(--space-3);
		background: var(--paper);
		color: var(--ink-2);
		font-size: var(--text-s);
		text-align: right;
		pointer-events: none;
	}
	.timeline {
		position: absolute;
		left: var(--space-4);
		bottom: var(--space-4);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border: var(--hair) solid var(--line);
		background: var(--paper);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		pointer-events: auto;
	}
	.scale {
		width: clamp(12rem, 36vw, 34rem);
		margin: 0 var(--space-6);
	}
	.scale.without-events {
		padding-top: var(--ctl-s);
	}
	.timeline output {
		position: absolute;
		width: 1px;
		height: 1px;
		clip-path: inset(50%);
		overflow: hidden;
	}
	.timeline :global(.cg-button) {
		min-width: 0;
		gap: var(--space-2);
	}
	@media (max-width: 980px) {
		.hint {
			display: none;
		}
	}
	/* Narrow screens: the tools lie along the bottom edge, options above them. */
	@media (max-width: 640px) {
		.hud-group {
			position: absolute;
			left: var(--space-2);
			right: var(--space-2);
			bottom: var(--space-2);
			display: flex;
			flex-direction: column-reverse;
			align-items: stretch;
			gap: var(--space-2);
			pointer-events: none;
		}
		.hud {
			position: static;
			translate: none;
			grid-template-columns: 1fr auto;
			grid-template-areas: 'options options' 'tools history';
			align-items: end;
			column-gap: var(--space-1);
		}
		.options {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-1);
		}
		.timeline {
			position: static;
			align-self: flex-start;
			padding-left: var(--space-2);
		}
		.scale {
			display: none;
		}
		.timeline output {
			position: static;
			width: auto;
			height: auto;
			clip-path: none;
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
	}
</style>
