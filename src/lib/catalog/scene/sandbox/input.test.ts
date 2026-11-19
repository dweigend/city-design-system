import { expect, test } from 'bun:test';
import { traceStroke, createWorld } from '../../logic/sandbox';
import { attachInput } from './input';
import { createView } from './view';

const { grid } = createWorld(7, { cells: 0 });
const points = ['87/35', '90/35', '90/38'];

class TestCanvas extends EventTarget {
	getBoundingClientRect() {
		return { left: 0, top: 0 };
	}
	setPointerCapture() {}
}

function simulate(drawFirstMove: boolean) {
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrame = 0;
	const saved = Object.getOwnPropertyDescriptors(globalThis);
	const globals = {
		window: new EventTarget(),
		requestAnimationFrame(callback: FrameRequestCallback) {
			frames.set(++nextFrame, callback);
			return nextFrame;
		},
		cancelAnimationFrame(id: number) {
			frames.delete(id);
		}
	};
	Object.assign(globalThis, globals);
	const canvas = new TestCanvas();
	let trace: Parameters<typeof traceStroke>[1] = { cellIds: [], lastPointerCellId: undefined };
	const sample = (x: number) => (trace = traceStroke(grid, trace, points[x]));
	const detach: () => void = Reflect.apply(attachInput, undefined, [
		canvas,
		createView(),
		{
			draws: () => true,
			hover: () => {},
			strokeStart: sample,
			strokeMove: sample,
			strokeEnd: () => {},
			viewChanged: () => {}
		}
	]);
	const send = (type: string, x: number) =>
		canvas.dispatchEvent(
			Object.assign(new Event(type), {
				clientX: x,
				clientY: 0,
				pointerId: 1,
				button: 0,
				pointerType: 'touch'
			})
		);
	try {
		send('pointerdown', 0);
		send('pointermove', 1);
		if (drawFirstMove) for (const callback of frames.values()) callback(0);
		send('pointermove', 2);
		send('pointerup', 2);
		return trace.cellIds;
	} finally {
		detach();
		for (const key of Object.keys(globals)) {
			if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
}

test('frame timing does not cut a buffered brush path across the corner', () => {
	const uninterrupted = simulate(true);
	expect(uninterrupted).toContain('90/35');
	expect(simulate(false)).toEqual(uninterrupted);
});
