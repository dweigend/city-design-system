import type { OrthographicCamera as StageCamera } from 'three';
import { PerspectiveCamera as Lens } from 'three';

export type ProjectionInput = Readonly<{ camera: StageCamera }>;

export function isPerspectiveLens(camera: unknown): boolean {
	return camera instanceof Lens;
}
