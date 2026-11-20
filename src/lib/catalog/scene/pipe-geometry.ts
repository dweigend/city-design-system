import * as THREE from 'three/webgpu';
import { chainage, sweepProfile } from '../logic/linear-path';
import type { Vec3 } from '../logic/parametrik/types';

/** Projects a circular path sweep with radial normals and a split texture seam. */
export function pipeGeometry(path: Vec3[], radius: number, sides: number) {
	const profile = Array.from({ length: sides }, (_, i): [number, number] => [
		radius * Math.cos((i * 2 * Math.PI) / sides),
		radius * Math.sin((i * 2 * Math.PI) / sides)
	]);
	profile.push(profile[0]);
	const skin = sweepProfile(path, profile, false),
		distances = chainage(path),
		length = distances[distances.length - 1];
	const positions: number[] = [],
		normals: number[] = [],
		uv: number[] = [];
	for (const [i, p] of path.entries())
		for (let j = 0; j <= sides; j++) {
			const [x, y, z] = skin.points[i * (sides + 1) + j];
			positions.push(x, z, -y);
			normals.push((x - p[0]) / radius, (z - p[2]) / radius, (p[1] - y) / radius);
			uv.push(distances[i] / length, j / sides);
		}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(skin.triangles);
	return g;
}
