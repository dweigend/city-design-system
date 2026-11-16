/**
 * Edges of many boxes as one LineSegments geometry with a color per box (one draw call).
 * Positions are fixed once; colors change only through the color attribute.
 */
import * as THREE from 'three';

/** Twelve edges of a unit cube (0–1) as segments, 6 numbers each. */
const EDGES = (() => {
	const out: number[] = [];
	for (const a of [0, 1])
		for (const b of [0, 1]) out.push(0, a, b, 1, a, b, a, 0, b, a, 1, b, a, b, 0, a, b, 1);
	return out;
})();

export type Kanten = {
	lines: THREE.LineSegments;
	setColor(i: number, c: THREE.Color): void;
	commit(): void;
	dispose(): void;
};

/** boxes: origin and size of each box in three coordinates. */
export function createKanten(boxes: { min: THREE.Vector3; size: THREE.Vector3 }[]): Kanten {
	const per = EDGES.length;
	const pos = new Float32Array(boxes.length * per);
	const col = new Float32Array(boxes.length * per);
	boxes.forEach(({ min, size }, i) => {
		for (let k = 0; k < per; k += 3) {
			pos[i * per + k] = min.x + EDGES[k] * size.x;
			pos[i * per + k + 1] = min.y + EDGES[k + 1] * size.y;
			pos[i * per + k + 2] = min.z + EDGES[k + 2] * size.z;
		}
	});
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	const material = new THREE.LineBasicMaterial({ vertexColors: true });
	const lines = new THREE.LineSegments(geo, material);
	return {
		lines,
		setColor(i, c) {
			for (let v = 0; v < per; v += 3) col.set([c.r, c.g, c.b], i * per + v);
		},
		commit() {
			geo.attributes.color.needsUpdate = true;
		},
		dispose() {
			geo.dispose();
			material.dispose();
		}
	};
}
