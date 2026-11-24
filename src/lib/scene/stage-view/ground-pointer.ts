import type { Vec3 } from '../../core/geometry';

/** One canvas pointer event and its hit on the last displayed terrain. */
export type GroundPointer = Readonly<{
	event: PointerEvent;
	ground?: Vec3;
	canvas: HTMLCanvasElement;
}>;
