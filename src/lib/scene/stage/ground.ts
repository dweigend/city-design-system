import { defaults } from '../../../config/stage';
import {
	BufferGeometry,
	Float32BufferAttribute,
	Mesh,
	MeshBasicNodeMaterial,
	type Line2NodeMaterial
} from 'three/webgpu';
import { LineSegments2 } from 'three/addons/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { float, materialColor } from 'three/tsl';
import type { Bounds3 } from '../../core/geometry';
import { graphite, grain, shadowReach, sun } from './tone';

export function shadowPolygon({ min, max }: Bounds3) {
	const [left, bottom, ground] = min;
	const [right, top, height] = max;
	const length = (height - ground) * shadowReach;
	const [dx, dy] = sun.map((axis) => -axis * length);
	const z = ground - defaults.stageShadowOffsetM;
	return [
		[left, bottom, z],
		[right, bottom, z],
		[right + dx, bottom + dy, z],
		[right + dx, top + dy, z],
		[left + dx, top + dy, z],
		[left, top, z]
	];
}

export function projectGround(bounds: Bounds3, footprint: Bounds3, pencil: Line2NodeMaterial) {
	const material = new MeshBasicNodeMaterial({ depthWrite: false });
	material.colorNode = graphite(
		materialColor,
		float(/* Exact arithmetic: zero leaves lightness unchanged. */ 0),
		float(grain.shadow)
	);
	const geometry = new BufferGeometry();
	geometry.setAttribute(
		'position',
		new Float32BufferAttribute(
			shadowPolygon(bounds).flat(),
			/* Exact arithmetic: XYZ components per vertex. */ 3
		)
	);
	geometry.setIndex(
		/* Exact arithmetic: triangle fan for a six-point shadow polygon. */ [
			0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5
		]
	);
	const shadow = new Mesh(geometry, material);
	shadow.renderOrder = defaults.stageShadowOrder;

	const { min, max } = footprint;
	const pad = Math.min(max[0] - min[0], max[1] - min[1]) * defaults.stageGroundOutlinePad;
	const z = min[2] - defaults.stageGroundOutlineOffsetM;
	const corners = [
		[min[0] - pad, min[1] - pad, z],
		[max[0] + pad, min[1] - pad, z],
		[max[0] + pad, max[1] + pad, z],
		[min[0] - pad, max[1] + pad, z]
	];
	const positions = corners.flatMap((corner, i) => [
		...corner,
		...corners[(i + 1) % corners.length]
	]);
	const outline = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), pencil);
	return { shadow, outline };
}
