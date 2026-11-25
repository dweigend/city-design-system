import type { Vec2 } from '../../lib/core/geometry';
import type { CellStorey } from '../../lib/domain/cell-space';
import type { Parcel } from '../../lib/domain/parcels';
import {
	createVerticalStroke,
	type StrokeInput,
	type VerticalTarget
} from '../../lib/scene/sandbox-interaction';
import type { View } from '../../lib/scene/stage';
import type { GroundPointer } from '../../lib/scene/stage-view';

export type VerticalPreview =
	| Readonly<{ kind: 'drag'; target: VerticalTarget; storeys: readonly CellStorey[] }>
	| Readonly<{ kind: 'plan'; target: VerticalTarget }>;

type Parcels = {
	readPoint: (point: Vec2) => Parcel | undefined;
	readSegment: (from: Vec2, to: Vec2) => readonly Parcel[];
};

const kinds: Readonly<Record<string, StrokeInput<Parcel>['type']>> = {
	pointerdown: 'down',
	pointermove: 'move',
	pointerup: 'up',
	pointercancel: 'cancel',
	lostpointercapture: 'lost'
};

/** Turns canvas pointer events into stroke inputs: the parcels the pointer crossed since the last
 * event, in path order. A primary-button press captures the pointer so the stroke follows it off
 * the canvas; `release` lets it go. */
export function createStrokePointer(polygons: Parcels, toWorld: (x: number, y: number) => Vec2) {
	let last: Vec2 | undefined;
	let held: { canvas: HTMLCanvasElement; pointer: number } | undefined;

	function read({ event, ground, canvas }: GroundPointer, tool: string) {
		const type = kinds[event.type];
		if (!type || (type === 'down' && event.button !== 0)) return undefined;
		const position = ground && toWorld(ground[0], ground[1]);
		if (type === 'down' && position) {
			canvas.focus({ preventScroll: true });
			canvas.setPointerCapture(event.pointerId);
			held = { canvas, pointer: event.pointerId };
		}
		const moved = held && last && position && (position[0] !== last[0] || position[1] !== last[1]);
		const point = position && polygons.readPoint(position);
		const hits =
			moved && last && position ? polygons.readSegment(last, position) : point ? [point] : [];
		last = held ? position : undefined;
		if (type === 'up' || type === 'cancel' || type === 'lost') {
			held = undefined;
			last = undefined;
		}
		return { type, pointer: event.pointerId, hits, tool } satisfies StrokeInput<Parcel>;
	}

	function release() {
		if (held?.canvas.hasPointerCapture(held.pointer))
			held.canvas.releasePointerCapture(held.pointer);
		held = undefined;
		last = undefined;
	}
	return { read, release };
}

/** Adapts a captured pointer to a temporary 3D stack or a discrete Plan selection. */
export function createVerticalPointer(
	readTarget: (input: GroundPointer) => VerticalTarget | undefined
) {
	type Capture = {
		canvas: HTMLCanvasElement;
		pointer: number;
		preview: VerticalPreview;
		stroke?: ReturnType<typeof createVerticalStroke>;
	};
	let held: Capture | undefined;

	function release() {
		const capture = held;
		held = undefined;
		if (capture?.canvas.hasPointerCapture(capture.pointer))
			capture.canvas.releasePointerCapture(capture.pointer);
	}

	function readCaptured(capture: Capture, { event, ray }: GroundPointer) {
		if (event.pointerId !== capture.pointer) return undefined;
		const type = kinds[event.type];
		const { preview, stroke } = capture;
		if (type === 'up' || type === 'cancel' || type === 'lost') {
			release();
			return type === 'up' && preview.kind === 'plan' ? preview : null;
		}
		if (type !== 'move' || preview.kind !== 'drag' || !ray || !stroke) return undefined;
		const storeys = stroke(ray) ?? [];
		if (
			storeys.length === preview.storeys.length &&
			storeys.every((storey, index) => storey === preview.storeys[index])
		)
			return undefined;
		capture.preview = { ...preview, storeys };
		return capture.preview;
	}

	function read(input: GroundPointer, view: View): VerticalPreview | null | undefined {
		if (held) return readCaptured(held, input);
		const { event, canvas, ray } = input;
		if (event.type !== 'pointerdown' || event.button !== 0 || !ray) return undefined;
		const target = readTarget(input);
		if (!target) return null;
		const stroke = view === 'iso' ? createVerticalStroke(target, ray) : undefined;
		if (view === 'iso' && !stroke) return null;
		const preview: VerticalPreview = stroke
			? { kind: 'drag', target, storeys: stroke(ray) ?? [] }
			: { kind: 'plan', target };
		canvas.focus({ preventScroll: true });
		canvas.setPointerCapture(event.pointerId);
		held = { canvas, pointer: event.pointerId, preview, stroke };
		return preview.kind === 'drag' ? preview : undefined;
	}

	return { read, release, isOpen: () => held !== undefined };
}

/** Tracks multi-finger touch gestures so navigation cancels editing and clears on release or cancel. */
export function createTouchNavigation() {
	const touches = new Set<number>();
	let panning = false;

	function read(event: Pick<PointerEvent, 'type' | 'pointerType' | 'pointerId' | 'isPrimary'>) {
		if (event.pointerType !== 'touch') return { panning, started: false, ended: false };
		const wasPanning = panning;
		if (event.type === 'pointerdown') {
			if (event.isPrimary) {
				touches.clear();
				panning = false;
			}
			touches.add(event.pointerId);
			if (!event.isPrimary && touches.size > 1) {
				panning = true;
				return { panning: true, started: !wasPanning, ended: false };
			}
			return { panning, started: false, ended: false };
		}
		if (
			event.type === 'pointerup' ||
			event.type === 'pointercancel' ||
			event.type === 'lostpointercapture'
		) {
			if (event.type === 'pointercancel' && event.isPrimary) touches.clear();
			else touches.delete(event.pointerId);
			if (touches.size === 0) panning = false;
			return { panning, started: false, ended: wasPanning };
		}
		return { panning, started: false, ended: false };
	}

	return { read, isPanning: () => panning };
}
