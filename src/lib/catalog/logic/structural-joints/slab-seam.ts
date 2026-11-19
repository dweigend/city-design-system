import type { End } from './contact-seat';
import { contactToleranceM, onFace, type Face, type Round } from './contact-surfaces';

/** Finds interior intersections of a vertical post with a slab face in world metres.
 * Endpoints are already handled by the endpoint survey. */
export function surveySlabSeam(run: Round, face: Face) {
	const [x, y, bottom] = run.a;
	const top = run.b[2];
	if (face.z <= bottom + contactToleranceM || face.z >= top - contactToleranceM) return;
	const point: End['point'] = [x, y, face.z];
	if (!onFace(face, point)) return;
	const axis: End['axis'] = [0, 0, face.up];
	return {
		end: { point, axis, length: face.up > 0 ? top - face.z : face.z - bottom },
		site: {
			seat: 'slab-seam' as const,
			point,
			supportNormal: axis,
			supportProfile: { kind: 'plane' as const },
			diameter: run.radius * 2
		}
	};
}
