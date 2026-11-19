import assert from 'node:assert/strict';
import { attachInput, type InputHooks } from '../../scene/sandbox/input';
import { createCanvasHover } from '../../scene/sandbox/canvas-hover';
import { createView } from '../../scene/sandbox/view';
import { previewStrokePlan, type Tool, type World } from '../../logic/sandbox';
import type { Completion, StrokeRelease } from '../feedback';
import { createSession } from './client-session';

class PointerCanvas extends EventTarget {
	getBoundingClientRect() {
		return { x: 0, y: 0, left: 0, top: 0, width: 1200, height: 800 };
	}
	setPointerCapture() {}
}

type Position = NonNullable<Parameters<InputHooks['hover']>[0]>;
type PickCell = (world: World, x: number, y: number) => number | undefined;

/** Drives the production input handler and client session with controlled release callbacks. */
export function gestureDriver(latency: (stroke: number) => number = () => 16, pick?: PickCell) {
	const session = createSession(7);
	const view = createView();
	view.resize(1200, 800);
	const events: Completion[] = [];
	const unsubscribe = session.onCompletion((event) => events.push(event));
	let displayed = session.world;
	let hovered: string | undefined;
	const hover = createCanvasHover(
		{
			show: (world) => (displayed = world),
			pickCell: (x, y) =>
				pick ? pick(displayed, x, y) : displayed.grid.cellsById.get(x + '/' + y)?.index
		},
		(id) => (hovered = id)
	);
	const show = () => hover.show(session.world, session.focus);
	const canvas = new PointerCanvas();
	const prior = Object.getOwnPropertyDescriptors(globalThis);
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrame = 0;
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
	let clock = 0;
	let stroke = 0;
	let waiting: { release: StrokeRelease; at: number } | undefined;
	const rings: Position[] = [];
	const hooks: InputHooks = {
		dispatch: (run) =>
			session.input(() => {
				show();
				run();
			}),
		pointerFeedback: (position) => rings.push(position),
		draws: () => session.tool.kind !== 'look',
		hover: hover.move,
		strokeStart: (x, y) => session.strokeStart(hover.move({ x, y })?.id),
		strokeMove: (x, y) => {
			const cell = hover.move({ x, y });
			if (cell) session.strokeMove(cell.id);
		},
		strokeEnd: () => {
			const release = session.strokeRelease();
			if (release) {
				assert.equal(waiting, undefined);
				waiting = { release, at: clock + latency(stroke++) };
			}
		},
		strokeCancel: session.strokeCancel,
		viewChanged: (position) => {
			if (position) hover.move(position);
		}
	};
	const detach: () => void = Reflect.apply(attachInput, undefined, [canvas, view, hooks]);
	show();

	function finish() {
		if (!waiting) return;
		const { release } = waiting;
		waiting = undefined;
		const plan = session.surveyRelease(release);
		if (plan) previewStrokePlan(plan);
		session.surveyRelease(release);
		session.commitRelease(release, show);
		session.commitRelease(release, show);
	}

	function tick(ms: number) {
		const until = clock + ms;
		while (waiting && waiting.at <= until) {
			clock = waiting.at;
			finish();
		}
		clock = until;
		for (const [id, callback] of [...frames]) {
			if (frames.delete(id)) callback(clock);
		}
	}

	function pointer(type: string, id: string, pointerType = 'touch', pointerId = 1) {
		const [clientX, clientY] = id.split('/').map(Number);
		canvas.dispatchEvent(
			Object.assign(new Event(type), {
				clientX,
				clientY,
				pointerId,
				pointerType,
				button: 0,
				shiftKey: false
			})
		);
		tick(0);
	}

	return {
		session,
		canvas,
		view,
		hover,
		events,
		rings,
		tick,
		finish,
		hovered: () => hovered,
		world: () => session.world,
		waiting: () => waiting?.release,
		down: (id: string) => pointer('pointerdown', id),
		move: (id: string) => pointer('pointermove', id),
		up: (id: string) => pointer('pointerup', id),
		pointer,
		stroke(tool: Tool, from: string, ...rest: string[]) {
			session.tool = tool;
			pointer('pointerdown', from);
			for (const id of rest) pointer('pointermove', id);
			pointer('pointerup', rest.at(-1) ?? from);
		},
		drain() {
			while (waiting) finish();
		},
		dispose() {
			detach();
			unsubscribe();
			session.disposeInput();
			for (const key of Object.keys(globals)) {
				if (prior[key]) Object.defineProperty(globalThis, key, prior[key]);
				else Reflect.deleteProperty(globalThis, key);
			}
		}
	};
}
