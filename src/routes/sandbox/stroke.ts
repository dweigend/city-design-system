import type { Vec2 } from '../../lib/core/geometry';
import type { Parcel } from '../../lib/domain/parcels';
import type { GroundPointer } from '../../lib/scene/stage-view';

type Parcels = {
	readPoint: (point: Vec2) => Parcel | undefined;
	readSegment: (from: Vec2, to: Vec2) => readonly Parcel[];
};

/** Tracks one captured pointer and emits its ordered, deduplicated parcel stroke on release. */
export function createStroke(
	polygons: Parcels,
	toWorld: (x: number, y: number) => Vec2,
	hover: (parcel: Parcel | undefined) => void,
	commit: (parcels: readonly Parcel[], tool: string) => void
) {
	let active:
		| {
				pointer: number;
				canvas: HTMLCanvasElement;
				tool: string;
				parcels: Map<string, Parcel>;
				last?: Vec2;
		  }
		| undefined;
	function read({ event, ground, canvas }: GroundPointer, tool: string, loading = false) {
		if (active && active.pointer !== event.pointerId) return;
		if (event.type === 'pointercancel' || event.type === 'lostpointercapture') {
			active = undefined;
			return;
		}
		if (loading) {
			if (event.type === 'pointerup') cancel();
			return;
		}
		if (event.type === 'pointerup' && !active) return;
		const position = ground && toWorld(ground[0], ground[1]);
		const parcel = position && polygons.readPoint(position);
		hover(parcel);
		if (tool === 'explore' && !active) return;
		if (event.type === 'pointerdown' && event.button === 0 && position) {
			canvas.focus({ preventScroll: true });
			canvas.setPointerCapture(event.pointerId);
			active = { pointer: event.pointerId, canvas, tool, parcels: new Map() };
		}
		if (!active) return;
		if (
			position &&
			active.last &&
			(position[0] !== active.last[0] || position[1] !== active.last[1])
		) {
			for (const hit of polygons.readSegment(active.last, position))
				active.parcels.set(hit.id, hit);
		} else if (parcel) active.parcels.set(parcel.id, parcel);
		active.last = position;
		if (event.type === 'pointerup') {
			const { parcels, tool: activeTool } = active;
			active = undefined;
			commit([...parcels.values()], activeTool);
		}
	}
	function cancel() {
		const stroke = active;
		active = undefined;
		if (stroke?.canvas.hasPointerCapture(stroke.pointer))
			stroke.canvas.releasePointerCapture(stroke.pointer);
	}
	return { read, cancel };
}
