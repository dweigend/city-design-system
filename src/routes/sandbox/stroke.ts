import type { Vec2 } from '../../lib/core/geometry';
import type { Parcel } from '../../lib/domain/parcels';
import type { StrokeInput } from '../../lib/scene/sandbox-interaction';
import type { GroundPointer } from '../../lib/scene/stage-view';

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
