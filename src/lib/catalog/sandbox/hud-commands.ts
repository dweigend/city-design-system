import {
	sandboxCovers,
	sandboxLines,
	sandboxMethods,
	sandboxTools,
	sandboxUses,
	type BuildingMethod,
	type SandboxToolId
} from '../data/sandbox';
import type { Tool } from '../logic/sandbox';
import type { Session } from './session.svelte';

/** Queues the activated item even when its committed selection is already displayed. */
export function activateChoice(run: () => void) {
	return {
		onclick(event: MouseEvent) {
			event.preventDefault();
			run();
		},
		onkeydown(event: KeyboardEvent) {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			if (!event.repeat) run();
		}
	};
}

/** Keeps tool preferences and sends HUD and keyboard selections through one command path. */
export function createHudCommands(session: Pick<Session, 'tool' | 'selectTool' | 'pickMethod'>) {
	let house = sandboxUses[0].id;
	let line = sandboxLines[0].id;
	let cover = sandboxCovers[0].id;

	function toolOf(kind: SandboxToolId): Tool {
		if (kind === 'house') return { kind, use: house };
		if (kind === 'line') return { kind, transit: line };
		if (kind === 'cover') return { kind, cover };
		return { kind };
	}

	function select(kind: SandboxToolId, value: string | number) {
		if (kind === 'house') house = selectedId(sandboxUses, value, house);
		if (kind === 'line') line = selectedId(sandboxLines, value, line);
		if (kind === 'cover') cover = selectedId(sandboxCovers, value, cover);
		return toolOf(kind);
	}

	return {
		/** Enqueues a specific tool from either input surface. */
		pickTool(id: SandboxToolId) {
			session.selectTool(() => toolOf(id), sandboxTools.find((tool) => tool.id === id)?.name);
		},
		/** Number shortcuts resolve against the active tool at replay time. */
		pickOption(index: number) {
			session.selectTool(() => select(session.tool.kind, index), `Option ${index + 1}`);
		},
		/** HUD options retain the identity of the item the player activated. */
		pickValue(kind: SandboxToolId, id: string, label: string) {
			session.selectTool(() => select(kind, id), label);
		},
		/** Enqueues the selected method by identity. */
		pickMethod(id: BuildingMethod) {
			session.pickMethod(id, sandboxMethods[id].name);
		}
	};
}

function selectedId<T extends string>(
	entries: readonly { id: T }[],
	value: string | number,
	current: T
) {
	const match = typeof value === 'number' ? entries[value] : entries.find(({ id }) => id === value);
	return match?.id ?? current;
}
