import { contactInk } from '../studio-quality';
import {
	DoubleSide,
	InstancedMesh,
	MeshBasicNodeMaterial,
	Object3D,
	PlaneGeometry,
	Vector3
} from 'three/webgpu';
import type { StructuralContact } from '../../logic/structural-joints';
import { uv } from 'three/tsl';
import type { Vec3 } from '../../logic/parametrik/types';

export type WashSeat = { point: Vec3; normal: Vec3; diameter: number };

/** Only surveyed upward bearing faces can receive a member's contact wash. */
export function bearingSeats(contacts: readonly StructuralContact[]): WashSeat[] {
	return contacts.flatMap((c) => {
		const normal = c.supportNormal;
		if (!normal || normal[2] <= 0 || !['terrain', 'wall-crest', 'slab-seam'].includes(c.seat))
			return [];
		return [{ point: c.point, normal, diameter: c.member.diameter }];
	});
}

/** One feathered patch on each surveyed bearing plane. Radius is in world metres. */
export function contactWash(seats: WashSeat[]) {
	if (!seats.length) return;
	const material = new MeshBasicNodeMaterial({
		color: contactInk.color,
		transparent: true,
		opacity: contactInk.opacity,
		depthWrite: false,
		side: DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: -2,
		polygonOffsetUnits: -2
	});
	material.opacityNode = uv()
		.sub(0.5)
		.length()
		.smoothstep(0.26, 0.5)
		.oneMinus()
		.mul(material.opacity);
	const distinct = new Map<string, WashSeat>();
	for (const seat of seats) {
		const key = seat.point.map((n) => n.toFixed(3)).join(',');
		if ((distinct.get(key)?.diameter ?? 0) < seat.diameter) distinct.set(key, seat);
	}
	const mesh = new InstancedMesh(new PlaneGeometry(), material, distinct.size);
	const localNormal = new Vector3(0, 0, 1);
	const normal = new Vector3();
	const pose = new Object3D();
	[...distinct.values()].forEach((c, i) => {
		const [x, y, z] = c.normal;
		normal.set(x, z, -y).normalize();
		pose.position.set(c.point[0], c.point[2], -c.point[1]).addScaledVector(normal, 0.008);
		pose.quaternion.setFromUnitVectors(localNormal, normal);
		pose.scale.setScalar(2 * c.diameter);
		pose.updateMatrix();
		mesh.setMatrixAt(i, pose.matrix);
	});
	mesh.name = 'Bearing contact shadows';
	return mesh;
}
