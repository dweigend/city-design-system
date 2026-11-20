<script lang="ts">
	import { keyboard } from '../ui/keyboard.svelte';
	import { Popover, Toggle, ToggleGroup } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import { flows } from '../data/focus';
	import { Timeline } from '../interface';
	import {
		Box,
		Dices,
		Droplets,
		Eraser,
		Grid2X2,
		Hand,
		House,
		Pill,
		Redo2,
		Route,
		Shovel,
		Trees,
		Undo2,
		X
	} from 'lucide-svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	import {
		sandboxCovers,
		sandboxLines,
		sandboxMethods,
		sandboxTools,
		sandboxUses,
		type SandboxOption,
		type SandboxTool,
		type SandboxToolId
	} from '../data/sandbox';
	import { activateChoice, createHudCommands } from './hud-commands';
	import { advanceMessage, rejectionMessage } from './feedback';
	import SandboxOptions from './SandboxOptions.svelte';
	import type { Session } from './session.svelte';

	/**
	 * Tools of the sandbox: one tool bar, the options of the active tool beside it, undo and a
	 * new terrain below. Thin: it only sets the session's tool and calls its actions.
	 */
	let {
		session,
		group = $bindable(),
		rail = $bindable(),
		timelineBar = $bindable(),
		hintBox = $bindable()
	}: {
		session: Session;
		group?: HTMLDivElement;
		rail?: HTMLDivElement;
		timelineBar?: HTMLDivElement;
		hintBox?: HTMLDivElement;
	} = $props();

	let sheetOpen = $state(false);
	const narrow = new MediaQuery('(max-width: 640px)');
	const methodIcons = {
		terrace: House,
		composed: Box,
		collage: Box,
		megastructure: Grid2X2,
		totem: Pill
	};
	const methods = $derived(
		session.methods
			.map((id) => ({ id, ...sandboxMethods[id], icon: methodIcons[id] }))
			.sort((a, b) => a.phase - b.phase)
	);
	const year = $derived(session.shownYear);
	const { year: currentYear, timeLayers } = $derived(session.timelineState);
	const range = $derived(session.timelineWindow);
	const stockYear = $derived(timeLayers.find((layer) => layer.year < range.min)?.year);
	const events = $derived(
		timeLayers
			.filter((layer) => layer.year >= range.min)
			.map(({ year, flows: layerFlows }) => ({
				year,
				flows: layerFlows,
				label: flows
					.filter(({ id }) => layerFlows.includes(id))
					.map(({ name }) => name)
					.join(', ')
			}))
	);

	const icons = { look: Hand, house: House, line: Route, cover: Trees, dig: Shovel, erase: Eraser };
	const commands = $derived(createHudCommands(session));

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
	const active = $derived(
		sandboxTools.find((tool) => tool.id === session.tool.kind) ?? sandboxTools[0]
	);
	const optionLabel = $derived(
		session.tool.kind === 'house' ? 'House use' : `${active.name} options`
	);
	const toolOrientation = $derived(narrow.current ? 'horizontal' : 'vertical');

	function toolLabels(tool: SandboxTool) {
		return {
			'aria-label': tool.name,
			'aria-keyshortcuts': keyboard.observed ? tool.shortcut : undefined,
			title: keyboard.observed ? `${tool.name} (${tool.shortcut})` : tool.name
		};
	}

	const houseHints: Partial<Record<string, string>> = {
		megastructure: 'Drag across roofs to span them with a carrier.',
		totem: 'Drag along an existing carrier to dock a group of three.'
	};
	const drawingHint = $derived(
		session.tool.kind === 'house' ? houseHints[session.method] : undefined
	);
	const lineHint = $derived(
		session.tool.kind === 'line' && session.tool.transit === 'walkway'
			? 'Draw a footbridge with stairs and a square at each end.'
			: undefined
	);
	const advanceReport = $derived(advanceMessage(session.completion));
	const failure = $derived(session.viewingPast ? undefined : session.failure);
	$effect(() => {
		if (failure && narrow.current) sheetOpen = true;
	});
	const hint = $derived(
		session.viewingPast
			? 'Return to the latest year to build.'
			: failure
				? rejectionMessage(failure.reason)
				: (advanceReport ?? drawingHint ?? lineHint ?? active.hint)
	);
	/** Sets the tool by its id for keyboard shortcuts. */
	export function pickTool(id: SandboxToolId) {
		commands.pickTool(id);
	}
	/** Sets option n (0-based) for keyboard shortcuts. */
	export function pickOption(index: number) {
		commands.pickOption(index);
	}
</script>

{#snippet pickers()}
	<ToggleGroup.Root
		type="single"
		orientation={toolOrientation}
		value={session.tool.kind}
		class="cg-sandbox-tools"
		aria-label="Tool"
	>
		{#each sandboxTools as tool (tool.id)}
			<ToggleGroup.Item
				value={tool.id}
				class="cg-button"
				data-variant="icon"
				{...toolLabels(tool)}
				{...activateChoice(() => pickTool(tool.id))}
			>
				<Icon icon={icons[tool.id]} size={24} />
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	{#if options.length}
		<div class="options">
			<SandboxOptions
				label={optionLabel}
				horizontal={narrow.current}
				{options}
				value={option}
				onpick={(entry) => commands.pickValue(session.tool.kind, entry.id, entry.name)}
			/>
			{#if session.tool.kind === 'house'}
				<SandboxOptions
					label="Building method"
					options={methods}
					value={session.method}
					horizontal={narrow.current}
					compact
					onpick={(entry) => commands.pickMethod(entry.id)}
				/>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet toolHint()}
	<div class="hint" bind:this={hintBox} class:warning={Boolean(failure)}>
		<span role="status">
			{hint}
			{#if failure && advanceReport}<span class="pending">{advanceReport}</span>{/if}
			{#if session.requestedChoice}<span class="pending">Pending · {session.requestedChoice}</span
				>{/if}
		</span>
		{#if failure}
			<Button
				variant="icon"
				label="Dismiss survey warning"
				title="Dismiss survey warning"
				onclick={session.dismissRejection}
			>
				{#snippet icon()}<Icon icon={X} size={20} />{/snippet}
			</Button>
		{/if}
	</div>
{/snippet}

<div class="hud-group" bind:this={group}>
	<div class="hud" bind:this={rail}>
		{#if narrow.current}
			<Popover.Root bind:open={sheetOpen}>
				<Popover.Trigger class="cg-tool-sheet-trigger">
					<Icon icon={icons[active.id]} size={20} />
					{active.name} tools
				</Popover.Trigger>
				<Popover.Content
					class="cg-tool-sheet"
					side="top"
					align="start"
					sideOffset={8}
					aria-label="Tools and options"
				>
					{@render pickers()}
					{@render toolHint()}
					<Popover.Close class="cg-button">Done</Popover.Close>
				</Popover.Content>
			</Popover.Root>
		{:else}
			{@render pickers()}
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
			<Button variant="icon" label="New terrain" onclick={session.restart}>
				{#snippet icon()}<Icon icon={Dices} size={24} />{/snippet}
			</Button>
		</div>
	</div>
	<div class="timeline" bind:this={timelineBar} role="group" aria-label="Timeline">
		<div class="scale" class:without-events={!events.length}>
			<Timeline
				{year}
				{events}
				{stockYear}
				min={range.min}
				max={range.max}
				labelEvery={false}
				mode={currentYear > range.min ? 'input' : 'readout'}
				step={session.generationYears}
				onYearChange={currentYear > range.min ? session.reviewYear : undefined}
			/>
		</div>
		<output aria-label="World year">{year}</output>
		<Tooltip text="Sponge city">
			{#snippet trigger(props)}
				<Toggle.Root
					{...props}
					bind:pressed={() => session.spongeCity, session.toggleSpongeCity}
					class="cg-button"
					data-variant="icon"
					aria-label="Sponge city"
					disabled={session.viewingPast}
				>
					<Icon icon={Droplets} size={20} />
				</Toggle.Root>
			{/snippet}
		</Tooltip>
		<Button
			variant="secondary"
			label="Advance"
			shortcut="Y"
			disabled={session.viewingPast}
			onclick={session.advance}
		/>
	</div>
	{#if !narrow.current}{@render toolHint()}{/if}
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
		grid-template-columns: auto var(--sandbox-target);
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
		.hud {
			max-height: calc(100dvh - 2 * var(--sandbox-target) - 2 * var(--space-6));
			overflow-y: auto;
			overscroll-behavior: contain;
			pointer-events: auto;
		}
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
	.pending {
		display: block;
		color: var(--ink);
	}
	.warning {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.warning :global(.cg-button) {
		min-width: var(--sandbox-target);
		min-height: var(--sandbox-target);
		pointer-events: auto;
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
	.timeline :global(.cg-button[data-variant='icon']) {
		min-width: var(--sandbox-target);
	}
	@media (min-width: 641px) and (max-width: 980px) {
		.hint {
			bottom: calc(var(--sandbox-target) + var(--space-6));
		}
	}
	/* Narrow screens: the tools lie along the bottom edge, options above them. */
	@media (max-width: 640px) {
		.hud-group {
			position: absolute;
			left: var(--space-2);
			right: var(--space-2);
			bottom: max(var(--space-2), env(safe-area-inset-bottom));
			display: grid;
			grid-template-columns: auto 1fr;
			grid-template-areas: 'trigger history' 'timeline timeline';
			gap: var(--space-2);
			pointer-events: none;
		}
		:global(.cg-tool-sheet-trigger) {
			grid-area: trigger;
			display: flex;
			align-items: center;
			gap: var(--space-2);
			min-height: var(--sandbox-target);
			padding-inline: var(--space-3);
			background: var(--paper);
			color: var(--ink);
			border: var(--hair) solid var(--ink);
			pointer-events: auto;
		}
		:global(.cg-tool-sheet) {
			display: flex;
			flex-direction: column;
			align-items: start;
			gap: var(--space-2);
			padding: var(--space-2);
			background: var(--paper);
			color: var(--ink);
			border: var(--hair) solid var(--line);
			max-width: calc(100vw - 2 * var(--space-2));
			max-height: min(65dvh, var(--bits-popover-content-available-height, 65dvh));
			overflow: auto;
			pointer-events: auto;
		}
		:global(.cg-tool-sheet) .hint {
			text-align: start;
		}
		.hud {
			display: contents;
		}
		.hint {
			position: static;
			grid-area: hint;
			justify-self: start;
			max-width: 100%;
			text-align: left;
		}
		.options {
			display: flex;
			flex-wrap: wrap;
			gap: var(--space-1);
		}
		.timeline {
			position: static;
			grid-area: timeline;
			min-width: 0;
		}
		.scale {
			flex: 1;
			min-width: 0;
			margin: 0 var(--space-2);
		}
		.scale.without-events {
			padding-top: 0;
		}
		:global(.cg-sandbox-tools),
		.history {
			grid-auto-flow: column;
			justify-self: start;
		}
		.history {
			justify-self: end;
		}
		:global(.cg-sandbox-tools > .cg-button + .cg-button),
		.history > :global(.cg-button + .cg-button) {
			margin-top: 0;
			margin-left: calc(-1 * var(--hair));
		}
	}
</style>
