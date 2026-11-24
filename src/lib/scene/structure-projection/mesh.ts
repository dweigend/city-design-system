import type { Vec3 } from '../../core/geometry';
import { mesh as createMesh, squareSegment } from '../../core/mesh';

export function mesh() {
	return createMesh();
}

/** Appends the same square-profile geometry used for structural members to a scene marker. */
export function addSegment(target: ReturnType<typeof mesh>, from: Vec3, to: Vec3, width: number) {
	target.append(squareSegment(from, to, width));
}
