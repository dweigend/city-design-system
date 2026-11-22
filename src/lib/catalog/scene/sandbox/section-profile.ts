import * as THREE from 'three/webgpu';

type Segment = readonly [THREE.Vector3, THREE.Vector3];

/** Intersects the rendered terrain triangles with the vertical cut plane. */
export function sectionSegments(geometry: THREE.BufferGeometry, plane: THREE.Plane): Segment[] {
	const position = geometry.getAttribute('position');
	const index = geometry.index;
	const face = Array.from({ length: 3 }, () => new THREE.Vector3());
	const segments: Segment[] = [];
	const count = index?.count ?? position.count;
	for (let i = 0; i < count; i += 3) {
		for (let corner = 0; corner < 3; corner++)
			face[corner].fromBufferAttribute(position, index?.getX(i + corner) ?? i + corner);
		const distances = face.map((point) => plane.distanceToPoint(point));
		const crossings: THREE.Vector3[] = [];
		for (let a = 0; a < 3; a++) {
			const b = (a + 1) % 3;
			const from = distances[a];
			const to = distances[b];
			if (from < 0 === to < 0) continue;
			crossings.push(face[a].clone().lerp(face[b], from / (from - to)));
		}
		const [a, b] = crossings;
		if (a && b && a.distanceToSquared(b) > 1e-12) segments.push([a, b]);
	}
	return segments;
}

/** Extrudes the visible cut edges down to the base datum in the same section plane. */
export function sectionFill(segments: readonly Segment[], baseM: number) {
	const positions: number[] = [];
	for (const [a, b] of segments) {
		positions.push(a.x, a.y, a.z, b.x, b.y, b.z, b.x, baseM, b.z);
		positions.push(a.x, a.y, a.z, b.x, baseM, b.z, a.x, baseM, a.z);
	}
	return new THREE.BufferGeometry().setAttribute(
		'position',
		new THREE.Float32BufferAttribute(positions, 3)
	);
}
