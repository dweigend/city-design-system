import {
	DoubleSide,
	InstancedMesh,
	MeshBasicNodeMaterial,
	Object3D,
	PlaneGeometry,
	Vector3
} from 'three/webgpu';
import { uv } from 'three/tsl';
import type { Vec3 } from '../../logic/parametrik/types';

export type WashSeat = { point: Vec3; normal: Vec3; diameter: number };

/** One feathered patch on each surveyed bearing plane. Radius is in world metres. */
export function contactWash(seats: WashSeat[]) {
	if (!seats.length) return;
	const material = new MeshBasicNodeMaterial({
		color: 0x453c38,
		transparent: true,
		depthWrite: false,
		side: DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -2
	});
	material.opacityNode = uv().sub(0.5).length().smoothstep(0.12, 0.5).oneMinus().mul(0.55);
	const mesh = new InstancedMesh(new PlaneGeometry(), material, seats.length);
	const localNormal = new Vector3(0, 0, 1);
	const normal = new Vector3();
	const pose = new Object3D();
	seats.forEach((c, i) => {
		const [x, y, z] = c.normal;
		normal.set(x, z, -y).normalize();
		pose.position.set(c.point[0], c.point[2], -c.point[1]).addScaledVector(normal, 0.008);
		pose.quaternion.setFromUnitVectors(localNormal, normal);
		pose.scale.setScalar(c.diameter + 1.4);
		pose.updateMatrix();
		mesh.setMatrixAt(i, pose.matrix);
	});
	mesh.name = 'Bearing contact shadows';
	return mesh;
}
