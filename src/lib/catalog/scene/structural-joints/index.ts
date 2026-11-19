import {
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	Matrix4,
	Vector3,
	type NodeMaterial
} from 'three/webgpu';
import type { Zoom } from '../../data/leitstil';
import type { StructuralJoint } from '../../logic/structural-joints';

import { pushThree } from '../world-space';

export type FrameMaterials = Record<StructuralJoint['stroke'], NodeMaterial> & {
	plate: NodeMaterial;
};

/** Projects one fitting using the carrier's shared frame inks and plate material.
 * The caller owns the returned mesh geometries and may share the materials across fittings.
 */
export function projectStructuralJoint(
	joint: StructuralJoint,
	zoom: Zoom,
	frame: FrameMaterials
): Group | undefined {
	if (zoom === 'stadt') return;
	const group = new Group();
	const position: number[] = [],
		direction: number[] = [];
	pushThree(position, joint.point);
	pushThree(direction, joint.axis);
	group.position.fromArray(position);
	const localX: number[] = [];
	pushThree(localX, joint.tangent);
	const x = new Vector3().fromArray(localX),
		y = new Vector3().fromArray(direction);
	group.quaternion.setFromRotationMatrix(
		new Matrix4().makeBasis(x, y, new Vector3().crossVectors(x, y))
	);
	for (const { feature, points, triangles } of joint.geometry) {
		const geometry = new BufferGeometry();
		const vertices: number[] = [];
		for (const point of points) pushThree(vertices, point);
		geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
		geometry.setIndex(triangles);
		geometry.computeVertexNormals();
		const mesh = new Mesh(
			geometry,
			feature === 'plate' || feature === 'jaw' ? frame.plate : frame[joint.stroke]
		);
		mesh.name = feature;
		mesh.userData.partId = joint.partId;
		group.add(mesh);
	}
	group.name = joint.partId;
	group.userData = {
		partId: joint.partId,
		owner: joint.owner,
		anchor: joint.anchor,
		built: joint.built
	};
	return group;
}
