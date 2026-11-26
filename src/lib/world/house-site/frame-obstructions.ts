import {
	convexHull,
	isConvexCounterclockwise,
	isSimpleRing,
	measurePolygon,
	type Bounds3,
	type Vec2
} from '../../core/geometry';
import type { Shape } from '../../core/object';
import type { FrameObstruction } from '../../domain/structure';

function isValidOutline(outline: readonly Vec2[]): boolean {
	return isSimpleRing(outline) && isConvexCounterclockwise(outline);
}

// Project each upward surface separately. A single bound for a grouped rim would fill
// the whole roof and hide viable bearing seats inside it.
function readMeshObstructions(
	{ positions, indices }: Extract<Shape, { kind: 'mesh' }>,
	baseZ: number
): FrameObstruction[] {
	const stride = /* Exact arithmetic: XYZ coordinates and triangle indices. */ 3;
	const obstructions: FrameObstruction[] = [];
	for (let i = 0; i < indices.length; i += stride) {
		const vertices = indices.slice(i, i + stride).map((index) => index * stride);
		const outline = vertices.map((index): Vec2 => [positions[index], positions[index + 1]]);
		if (measurePolygon(outline).area <= 0 || !isValidOutline(outline)) continue;
		const topZ = Math.max(...vertices.map((index) => positions[index + stride - 1]));
		if (topZ > baseZ) obstructions.push({ outline, baseZ, topZ });
	}
	return obstructions;
}

export function readFrameObstructions(
	shape: Shape,
	{ min: [x0, y0, baseZ], max: [x1, y1, topZ] }: Bounds3
): readonly FrameObstruction[] {
	if (x1 <= x0 || y1 <= y0 || topZ <= baseZ) return [];
	if (shape.kind === 'mesh') {
		const surfaces = readMeshObstructions(shape, baseZ);
		if (surfaces.length) return surfaces;
	}
	const outline: readonly Vec2[] =
		shape.kind === 'prism'
			? convexHull(shape.polygon)
			: [
					[x0, y0],
					[x1, y0],
					[x1, y1],
					[x0, y1]
				];
	return isValidOutline(outline) ? [{ outline, baseZ, topZ }] : [];
}
