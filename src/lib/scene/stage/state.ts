import type { Drawable } from '../surface';
import { readView, type View } from './camera';
import { readDisplay, type Display } from './material';

export function stageState(hardware: boolean, adapterName: string) {
	let view: View = 'iso';
	let display: Display = 'normal';
	let drawableCount = 0;
	let geometryBuildCount = 0;
	let geometryBatchCount = 0;
	return {
		show(drawables: readonly Drawable[], builds: number) {
			drawableCount = drawables.length;
			geometryBuildCount += builds;
			if (builds) geometryBatchCount++;
		},
		setView(next: View) {
			readView(next);
			if (view === next) return false;
			view = next;
			return true;
		},
		setDisplay(next: Display) {
			readDisplay(next);
			if (display === next) return false;
			display = next;
			return true;
		},
		read(this: void) {
			return {
				view,
				display,
				drawableCount,
				geometryBuildCount,
				geometryBatchCount,
				hardware,
				adapterName
			};
		}
	};
}
