import assert from 'node:assert/strict';
import { applyStroke, traceStroke, type World } from '../../../logic/sandbox';
import type { createCanvasHover } from '../canvas-hover';
import { attachInput } from '../input';
import type { View } from '../view';

class PointerCanvas extends EventTarget {
	getBoundingClientRect() {
		return { left: 0, top: 0 };
	}
	setPointerCapture() {}
}

/** Drives a stationary touch down and up through the input handler around a roof swap. */
export function checkHeldErase(
	view: View,
	hover: ReturnType<typeof createCanvasHover>,
	base: World,
	next: World,
	position: { x: number; y: number }
) {
	const canvas = new PointerCanvas();
	let target: ReturnType<typeof hover.startStroke>;
	let trace: Parameters<typeof traceStroke>[1] = { cellIds: [], lastPointerCellId: undefined };
	const commits: (() => World)[] = [];
	const detach: () => void = Reflect.apply(attachInput, undefined, [
		canvas,
		view,
		{
			draws: () => true,
			hover: hover.move,
			strokeStart(x: number, y: number) {
				target = hover.startStroke({ x, y });
				assert.ok(target?.cell);
				trace = traceStroke(target.world.grid, trace, target.cell.id);
			},
			strokeMove(x: number, y: number) {
				const cell = hover.move({ x, y });
				assert.ok(target && cell);
				trace = traceStroke(target.world.grid, trace, cell.id);
			},
			strokeEnd() {
				assert.ok(target);
				const { world } = target;
				const { cellIds } = trace;
				commits.push(() => {
					const result = applyStroke(world, { kind: 'erase' }, cellIds).draft;
					hover.endStroke();
					return result;
				});
			},
			viewChanged() {}
		}
	]);

	try {
		hover.show(base, 'all');
		touch(canvas, 'pointerdown', position);
		hover.show(next, 'all');
		assert.equal(commits.length, 0);
		touch(canvas, 'pointerup', position);
		assert.deepEqual(trace.cellIds, ['81/39']);
		assert.equal(commits.length, 1);
		assert.equal(hover.cellAt(position.x, position.y)?.id, '81/39');
		const result = commits[0]();
		assert.equal(result.state.stacks.has('81/39'), false);
		assert.equal(result.state.stacks.get('81/38'), base.state.stacks.get('81/38'));
		assert.equal(hover.cellAt(position.x, position.y)?.id, next.roofBuilder ? '81/38' : '81/39');
		return result.state;
	} finally {
		detach();
	}
}

function touch(canvas: PointerCanvas, type: string, { x, y }: { x: number; y: number }) {
	canvas.dispatchEvent(
		Object.assign(new Event(type), {
			clientX: x,
			clientY: y,
			pointerType: 'touch',
			pointerId: 1,
			button: 0
		})
	);
}
