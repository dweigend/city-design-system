import {
	BufferGeometry,
	Float32BufferAttribute,
	MeshBasicNodeMaterial,
	type Node
} from 'three/webgpu';
import { attribute, float } from 'three/tsl';
import { valleyCoords } from '../../logic/terrain';
import type { TerrainGrid } from '../../logic/terrain-grid';

export type Pier = { foot: readonly number[]; radius: number };

/** Samples each support in the valley tangent frame. Quads lie on the water plane, clipped by land depth. */
export function wakeGeometry(grid: TerrainGrid, piers: readonly Pier[]) {
	const p: number[] = [],
		uv: number[] = [];
	const z = grid.terrain.waterLevel;
	for (const {
		foot: [x, y],
		radius
	} of piers) {
		const at = valleyCoords(grid.terrain, x, y)[0];
		const dx = valleyCoords(grid.terrain, x + 1, y)[0] - at,
			dy = valleyCoords(grid.terrain, x, y + 1)[0] - at;
		const norm = Math.hypot(dx, dy) || 1,
			tx = dx / norm,
			ty = dy / norm,
			w = 2 * radius;
		for (const [u, v] of [
			[-2, -3],
			[4, -3],
			[4, 3],
			[-2, -3],
			[4, 3],
			[-2, 3]
		]) {
			p.push(x + w * (u * tx - v * ty), z, -(y + w * (u * ty + v * tx)));
			uv.push(u, v);
		}
	}
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(p, 3));
	geometry.setAttribute('wakeUV', new Float32BufferAttribute(uv, 2));
	return geometry;
}

/** Two diverging strokes run 3.6 support diameters downstream with a subdued moving highlight. */
export function wakeInk(ink: Node<'vec3'>, seconds: Node<'float'>, visibility: Node<'float'>) {
	const m = new MeshBasicNodeMaterial({
		transparent: true,
		depthWrite: false,
		polygonOffset: true,
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});
	const q = attribute('wakeUV', 'vec2'),
		arm = q.y.abs().sub(q.x.mul(0.33).add(0.44)).abs();
	const aa = arm.fwidth().max(0.025);
	const line = float(1).sub(arm.smoothstep(float(0.075).sub(aa), float(0.075).add(aa)));
	const ends = q.x.smoothstep(-0.15, 0.28).mul(float(1).sub(q.x.smoothstep(3.2, 3.65)));
	const pulse = q.x.mul(1.4).sub(seconds.mul(0.32)).cos().mul(0.07).add(0.22);
	m.colorNode = ink;
	m.opacityNode = line.mul(ends).mul(pulse).mul(visibility);
	return m;
}
