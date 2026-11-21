import type { Vec3 } from '../parametrik/types';
import { parcelSurfaceHeight } from '../quad-grid';
import type { Section } from './types';

/** Interpolates the two ground triangles of the painted carrier at a station. */
export function terrainHeight(s: Section, [x, y]: Vec3) {
	return parcelSurfaceHeight(s.cells, x, y);
}
