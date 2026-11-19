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
	/** True if the primary pointer draws; false if it pans the view. */
	draws: () => boolean;
	/** Pointer position over the canvas in CSS pixels, or undefined when it leaves. */
	hover: (position: { x: number; y: number } | undefined) => void;
	strokeStart: (x: number, y: number) => void;
	strokeMove: (x: number, y: number) => void;
	strokeEnd: () => void;
	/** Called after every view change. */
	viewChanged: (position?: { x: number; y: number }) => void;
};

/** Attaches the listeners to a canvas. Returns the function that removes them again. */
export function attachInput(canvas: HTMLCanvasElement, view: View, hooks: InputHooks): () => void {
	const pointers = new Map<number, { x: number; y: number }>();
	let mode: 'idle' | 'draw' | 'pan' | 'pinch' = 'idle';
	let pinchDistance = 0;

	const local = (event: PointerEvent | WheelEvent) => {
		const box = canvas.getBoundingClientRect();
		return { x: event.clientX - box.left, y: event.clientY - box.top };
	};
	const center = () => {
		const [a, b] = [...pointers.values()];
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
	};
	function endStroke() {
		if (mode === 'draw') hooks.strokeEnd();
	}

	function startSinglePointer(event: PointerEvent, position: { x: number; y: number }) {
		const primary = event.button === 0 && !event.shiftKey;
		if (primary && hooks.draws()) {
			mode = 'draw';
			hooks.strokeStart(position.x, position.y);
		} else mode = 'pan';
	}

	function down(event: PointerEvent) {
		canvas.setPointerCapture(event.pointerId);
		const position = local(event);
		pointers.set(event.pointerId, position);
		hooks.hover(position);
		if (pointers.size === 2) {
			endStroke();
			mode = 'pinch';
			pinchDistance = center().distance;
			return;
		}
		startSinglePointer(event, position);
	}

	function movePinch(dx: number, dy: number) {
		if (pointers.size !== 2) return;
		const now = center();
		view.pan(dx / 2, dy / 2);
		view.zoomAt(pinchDistance / Math.max(1, now.distance), now.x, now.y);
		pinchDistance = now.distance;
	}

	function moveView(dx: number, dy: number, position: { x: number; y: number }) {
		if (mode === 'pan') {
			view.pan(dx, dy);
		} else if (mode === 'pinch') movePinch(dx, dy);
		hooks.viewChanged(position);
	}

	function move(event: PointerEvent) {
		const position = local(event);
		const previous = pointers.get(event.pointerId);
		if (!previous) return hooks.hover(position);
		pointers.set(event.pointerId, position);
		if (mode === 'draw') {
			hooks.hover(position);
			hooks.strokeMove(position.x, position.y);
		} else moveView(position.x - previous.x, position.y - previous.y, position);
	}

	function up(event: PointerEvent) {
		if (!pointers.delete(event.pointerId)) return;
		endStroke();
		mode = pointers.size ? 'pan' : 'idle';
	}

	function wheel(event: WheelEvent) {
		event.preventDefault();
		const position = local(event);
		view.zoomAt(Math.exp(event.deltaY * WHEEL_ZOOM), position.x, position.y);
		hooks.viewChanged(position);
	}

	function key(event: KeyboardEvent) {
		const pans: Record<string, [number, number]> = {
			ArrowLeft: [KEY_PAN_PX, 0],
			ArrowRight: [-KEY_PAN_PX, 0],
			ArrowUp: [0, KEY_PAN_PX],
			ArrowDown: [0, -KEY_PAN_PX]
		};
		const zooms: Record<string, number> = { '+': 1 / KEY_ZOOM, '=': 1 / KEY_ZOOM, '-': KEY_ZOOM };
		const box = canvas.getBoundingClientRect();
		if (pans[event.key]) view.pan(...pans[event.key]);
		else if (zooms[event.key]) view.zoomAt(zooms[event.key], box.width / 2, box.height / 2);
		else return;
		event.preventDefault();
		hooks.viewChanged();
	}

	const leave = () => hooks.hover(undefined);
	const menu = (event: Event) => event.preventDefault();
	canvas.addEventListener('pointerdown', down);
	canvas.addEventListener('pointermove', move);
	canvas.addEventListener('pointerup', up);
	canvas.addEventListener('pointercancel', up);
	canvas.addEventListener('pointerleave', leave);
	canvas.addEventListener('wheel', wheel, { passive: false });
	canvas.addEventListener('keydown', key);
	canvas.addEventListener('contextmenu', menu);
	return () => {
		canvas.removeEventListener('pointerdown', down);
		canvas.removeEventListener('pointermove', move);
		canvas.removeEventListener('pointerup', up);
		canvas.removeEventListener('pointercancel', up);
		canvas.removeEventListener('pointerleave', leave);
		canvas.removeEventListener('wheel', wheel);
		canvas.removeEventListener('keydown', key);
		canvas.removeEventListener('contextmenu', menu);
	};
}
