import type { SandboxStage } from './stage';
import type { InputHooks } from './input';
import type { World } from '../../logic/sandbox';

/** Keeps the cursor and brush tied to the same displayed world and canvas position. */
export function createCanvasHover(
	stage: Pick<SandboxStage, 'show' | 'pickCell'>,
	publish: (cellId: string | undefined) => void
) {
	let shown: World | undefined;
	let pointer: Parameters<InputHooks['hover']>[0];
	let drawing = false;
	let pending: Parameters<SandboxStage['show']> | undefined;

	function cellAt(x: number, y: number) {
		const index = stage.pickCell(x, y);
		return index === undefined ? undefined : shown?.grid.cells[index];
	}
	function refresh() {
		const cell = pointer && cellAt(pointer.x, pointer.y);
		publish(cell?.id);
		return cell;
	}
	function show(...projection: Parameters<SandboxStage['show']>) {
		stage.show(...projection);
		shown = projection[0];
		refresh();
	}

	return {
		cellAt,
		refresh,
		move(position: typeof pointer) {
			pointer = position;
			return refresh();
		},
		/** Captures the displayed projection and its first hit before accepting draw samples. */
		startStroke(position: NonNullable<typeof pointer>) {
			if (!shown) return;
			drawing = true;
			pointer = position;
			return { world: shown, cell: refresh() };
		},
		/** Releases the projection and displays the latest world or focus requested during drawing. */
		endStroke() {
			drawing = false;
			if (!pending) return;
			const projection = pending;
			pending = undefined;
			show(...projection);
		},
		/** Updates the display, deferring replacements until the active trace has sampled release. */
		show(...projection: Parameters<SandboxStage['show']>) {
			if (drawing) pending = projection;
			else show(...projection);
		}
	};
}
