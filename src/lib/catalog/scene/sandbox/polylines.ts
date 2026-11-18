import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Line2NodeMaterial } from 'three/webgpu';
import type { Vec3 } from '../../logic/parametrik/types';
import { pushThree } from '../world-space';

function appendSegments(positions: number[], line: readonly Vec3[]) {
	const segments = line.length === 2 ? 1 : line.length;
	for (let i = 0; i < segments; i++) {
		pushThree(positions, line[i]);
		pushThree(positions, line[(i + 1) % line.length]);
	}
}

/**
 * Screen-width lines from world polylines in meters. A polyline of two points is one
 * segment; longer ones are closed loops. Returns undefined for an empty input.
 * The caller owns the object and disposes its geometry.
 */
export function polylineObject(
	polylines: readonly (readonly Vec3[])[],
	material: Line2NodeMaterial
): LineSegments2 | undefined {
	const positions: number[] = [];
	for (const line of polylines) appendSegments(positions, line);
	if (!positions.length) return undefined;
	return new LineSegments2(new LineSegmentsGeometry().setPositions(positions), material);
}
