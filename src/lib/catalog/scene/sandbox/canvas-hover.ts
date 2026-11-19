import type { SandboxStage } from './stage';
import type { InputHooks } from './input';
import type { World } from '../../logic/sandbox';

/** Keeps the cursor and brush tied to the same displayed world and canvas position. */
export function createCanvasHover(
	stage: Pick<SandboxStage, 'show' | 'pickCell' | 'afterFrame'>,
	publish: (cellId: string | undefined) => void
) {
	let shown: World | undefined;
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
		dispose: stage.afterFrame(refresh),
		move(position: typeof pointer) {
			pointer = position;
			return refresh();
		},
		show(world: World, focus: Parameters<SandboxStage['show']>[1], place = false) {
			stage.show(world, focus, place);
			shown = world;
		}
	};
}
