import type { SandboxStage } from './stage';
import type { InputHooks } from './input';
import type { World } from '../../logic/sandbox';

/** Keeps cursor picks on the installed world and remembers a stationary pointer across redraws. */
export function createCanvasHover(
	stage: Pick<SandboxStage, 'show' | 'pickCell'> & Partial<Pick<SandboxStage, 'afterFrame'>>,
	publish: (cellId: string | undefined) => void
) {
	let shown: World | undefined;
	let focus: Parameters<SandboxStage['show']>[1] | undefined;
	let pointer: Parameters<InputHooks['hover']>[0];

	function cellAt(x: number, y: number) {
		const index = stage.pickCell(x, y);
		return index === undefined ? undefined : shown?.grid.cells[index];
	}

	function refresh() {
		const cell = pointer && cellAt(pointer.x, pointer.y);
		publish(cell?.id);
		return cell;
	}

	return {
		cellAt,
		refresh,
		dispose: stage.afterFrame?.(refresh) ?? (() => {}),
		move(position: typeof pointer) {
			pointer = position;
			return refresh();
		},
		show(world: World, nextFocus: Parameters<SandboxStage['show']>[1], place = false) {
			if (shown === world && focus === nextFocus) return;
			stage.show(world, nextFocus, place);
			shown = world;
			focus = nextFocus;
			if (!stage.afterFrame) refresh();
		}
	};
}
