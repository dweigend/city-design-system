/**
 * Pointer, wheel and keyboard input of the sandbox canvas. Separates two intents: moving the
 * view (handled here) and drawing a stroke (reported to the host). View state only (A-53).
 */
import type { View } from './view';

/** Pixels per key press when panning with the arrow keys. */
const KEY_PAN_PX = 80;
const KEY_ZOOM = 1.25;
const WHEEL_ZOOM = 0.0015;

export type InputHooks = {
	/** Receives raw input before interpreting its gesture or picking. */
	dispatch?: (run: () => void) => void;
	/** Immediate acknowledgement, even while a previous commit is pending. */
	pointerFeedback?: (position: { x: number; y: number }) => void;
	/** True if the primary pointer draws; false if it pans the view. */
	draws: () => boolean;
	/** Pointer position over the canvas in CSS pixels, or undefined when it leaves. */
	hover: (position: { x: number; y: number } | undefined) => void;
	strokeStart: (x: number, y: number) => void;
	strokeMove: (x: number, y: number) => void;
	strokeEnd: (releasedAt: number) => void;
	strokeCancel?: () => void;
	/** Called after every view change. */
	viewChanged: (position?: { x: number; y: number }) => void;
};

/** Attaches the listeners to a canvas. Returns the function that removes them again. */
export function attachInput(canvas: HTMLCanvasElement, view: View, hooks: InputHooks): () => void {
	const dispatch = hooks.dispatch ?? ((run: () => void) => run());
	const pointers = new Map<number, { x: number; y: number }>();
	let mode: 'idle' | 'draw' | 'pan' | 'pinch' = 'idle';
	let pinchDistance = 0;

	const local = (event: PointerEvent | WheelEvent, box = canvas.getBoundingClientRect()) => {
		return { x: event.clientX - box.left, y: event.clientY - box.top };
	};
	const center = () => {
		const [a, b] = [...pointers.values()];
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
	};
	let drawFrame = 0;
	const queued: { x: number; y: number }[] = [];

	function flushDraw() {
		cancelAnimationFrame(drawFrame);
		drawFrame = 0;
		for (const { x, y } of queued.splice(0)) hooks.strokeMove(x, y);
	}

	function cancelDraw(clearHover = true) {
		cancelAnimationFrame(drawFrame);
		drawFrame = 0;
		queued.length = 0;
		if (mode === 'draw') hooks.strokeCancel?.();
		if (clearHover) hooks.hover(undefined);
	}

	function startSinglePointer(primary: boolean, position: { x: number; y: number }) {
		if (primary && hooks.draws()) {
			mode = 'draw';
			hooks.strokeStart(position.x, position.y);
		} else {
			mode = 'pan';
			hooks.hover(undefined);
		}
	}

	function down(id: number, position: { x: number; y: number }, primary: boolean) {
		pointers.set(id, position);
		if (pointers.size === 1) startSinglePointer(primary, position);
		if (pointers.size === 2) {
			cancelDraw();
			mode = 'pinch';
			pinchDistance = center().distance;
		}
	}

	function movePinch(dx: number, dy: number) {
		if (pointers.size !== 2) return;
		const now = center();
		view.pan(dx / 2, dy / 2);
		view.zoomAt(pinchDistance / Math.max(1, now.distance), now.x, now.y);
		pinchDistance = now.distance;
	}

	function moveView(dx: number, dy: number, position?: { x: number; y: number }) {
		if (mode === 'pan') {
			view.pan(dx, dy);
		} else if (mode === 'pinch') movePinch(dx, dy);
		hooks.viewChanged(position);
	}

	function queueDraw(samples: { x: number; y: number }[]) {
		queued.push(...samples);
		if (!drawFrame) drawFrame = requestAnimationFrame(flushDraw);
	}

	function move(id: number, touch: boolean, samples: { x: number; y: number }[]) {
		const position = samples[samples.length - 1];
		const previous = pointers.get(id);
		if (!previous) {
			if (!touch) hooks.hover(position);
			return;
		}
		pointers.set(id, position);
		if (mode === 'draw') queueDraw(samples);
		else moveView(position.x - previous.x, position.y - previous.y, touch ? undefined : position);
	}

	function releaseStroke(position: { x: number; y: number }, touch: boolean, at: number) {
		queued.push(position);
		flushDraw();
		hooks.strokeEnd(at);
		hooks.hover(touch ? undefined : position);
	}

	function remainingMode() {
		// After pinching, keep the remaining finger in pan mode until it lifts.
		mode = pointers.size ? 'pan' : 'idle';
		if (pointers.size === 2) {
			mode = 'pinch';
			pinchDistance = center().distance;
		}
	}

	function finish(id: number, position: { x: number; y: number }, touch: boolean, at?: number) {
		if (!pointers.delete(id)) return;
		if (mode === 'draw') {
			if (at === undefined) cancelDraw();
			else releaseStroke(position, touch, at);
		}
		remainingMode();
	}

	function onDown(event: PointerEvent) {
		const { pointerId, pointerType, button, shiftKey } = event;
		const position = local(event);
		const primary = button === 0 && !shiftKey;
		// Pointer capture is only available while the native pointer is active.
		canvas.setPointerCapture(pointerId);
		if (primary && pointerType !== 'mouse' && event.isPrimary !== false)
			hooks.pointerFeedback?.(position);
		dispatch(() => down(pointerId, position, primary));
	}

	function onMove(event: PointerEvent) {
		const { pointerId, pointerType } = event;
		const box = canvas.getBoundingClientRect();
		const samples = (event.getCoalescedEvents?.() ?? []).map((sample) => local(sample, box));
		samples.push(local(event, box));
		dispatch(() => move(pointerId, pointerType === 'touch', samples));
	}

	function onFinish(event: PointerEvent) {
		const { pointerId, pointerType, timeStamp, type } = event;
		const position = local(event);
		dispatch(() =>
			finish(
				pointerId,
				position,
				pointerType === 'touch',
				type === 'pointerup' ? timeStamp : undefined
			)
		);
	}

	function stopDrawing(clearHover = true) {
		if (mode !== 'draw') return;
		cancelDraw(clearHover);
		mode = 'idle';
	}

	function outsideDown(event: PointerEvent) {
		if (event.pointerType === 'touch' && event.target !== canvas) dispatch(stopDrawing);
	}

	function wheel(event: WheelEvent) {
		event.preventDefault();
		const position = local(event);
		const factor = Math.exp(event.deltaY * WHEEL_ZOOM);
		dispatch(() => {
			stopDrawing(false);
			view.zoomAt(factor, position.x, position.y);
			hooks.viewChanged(position);
		});
	}

	function key(event: KeyboardEvent) {
		const pans: Record<string, [number, number]> = {
			ArrowLeft: [KEY_PAN_PX, 0],
			ArrowRight: [-KEY_PAN_PX, 0],
			ArrowUp: [0, KEY_PAN_PX],
			ArrowDown: [0, -KEY_PAN_PX]
		};
		const zooms: Record<string, number> = { '+': 1 / KEY_ZOOM, '=': 1 / KEY_ZOOM, '-': KEY_ZOOM };
		const pan = pans[event.key];
		const zoom = zooms[event.key];
		if (!pan && !zoom) return;
		event.preventDefault();
		dispatch(() => {
			stopDrawing(false);
			const box = canvas.getBoundingClientRect();
			if (pan) view.pan(...pan);
			else view.zoomAt(zoom, box.width / 2, box.height / 2);
			hooks.viewChanged();
		});
	}

	const leave = () => dispatch(() => hooks.hover(undefined));
	const menu = (event: Event) => event.preventDefault();
	window.addEventListener('pointerdown', outsideDown, true);
	canvas.addEventListener('pointerdown', onDown);
	canvas.addEventListener('pointermove', onMove);
	canvas.addEventListener('pointerup', onFinish);
	canvas.addEventListener('pointercancel', onFinish);
	canvas.addEventListener('lostpointercapture', onFinish);
	canvas.addEventListener('pointerleave', leave);
	canvas.addEventListener('wheel', wheel, { passive: false });
	canvas.addEventListener('keydown', key);
	canvas.addEventListener('contextmenu', menu);
	return () => {
		window.removeEventListener('pointerdown', outsideDown, true);
		canvas.removeEventListener('pointerdown', onDown);
		canvas.removeEventListener('pointermove', onMove);
		cancelAnimationFrame(drawFrame);
		canvas.removeEventListener('pointerup', onFinish);
		canvas.removeEventListener('pointercancel', onFinish);
		canvas.removeEventListener('lostpointercapture', onFinish);
		canvas.removeEventListener('pointerleave', leave);
		canvas.removeEventListener('wheel', wheel);
		canvas.removeEventListener('keydown', key);
		canvas.removeEventListener('contextmenu', menu);
	};
}
