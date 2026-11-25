import type { Vec3 } from '../../core/geometry';
import type { CameraRay } from '../stage';

/** One canvas pointer event with its ray and terrain hit from the last rendered frame. */
export type GroundPointer = Readonly<{
	event: PointerEvent;
	ground?: Vec3;
	ray?: CameraRay;
	canvas: HTMLCanvasElement;
}>;
