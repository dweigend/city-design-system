import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, type Line2NodeMaterial } from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { uv } from 'three/tsl';
import type { Bounds3 } from '../../core/geometry';

function groundLayout({ min, max }: Bounds3) {
	const width = max[0] - min[0];
	const depth = max[1] - min[1];
	const centerX = (min[0] + max[0]) / 2;
	const centerY = (min[1] + max[1]) / 2;
	const z = min[2] - 0.002;
	const padding = Math.min(width, depth) * 0.065;
	return { width, depth, centerX, centerY, z, padding };
}

export function projectGround(bounds: Bounds3, pencil: Line2NodeMaterial) {
	const { width, depth, centerX, centerY, z, padding } = groundLayout(bounds);
	const shadow = new Mesh(new PlaneGeometry(width * 1.22, depth * 1.36), contactMaterial());
	shadow.position.set(centerX + width * 0.035, centerY + depth * 0.065, z);
	shadow.renderOrder = -1;

	const x = width / 2 + padding;
	const y = depth / 2 + padding;
	const corners = [
		[-x, -y, 0],
		[x, -y, 0],
		[x, y, 0],
		[-x, y, 0]
	];
	const positions = corners.flatMap((corner, i) => [
		...corner,
		...corners[(i + 1) % corners.length]
	]);
	const outline = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), pencil);
	outline.position.set(centerX, centerY, z + 0.001);
	outline.renderOrder = 1;
	return { shadow, outline };
}

function contactMaterial() {
	const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
	const distance = uv().sub(0.5).abs().mul(2);
	material.opacityNode = distance.x.max(distance.y).smoothstep(0.6, 1).oneMinus().mul(0.26);
	return material;
}
