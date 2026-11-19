import { color, mix, uv } from 'three/tsl';
import type { createStudioLight } from './studio-light';
import { Box3, Mesh, PlaneGeometry, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu';

/** Fits a shadow-only paper floor beneath a model without contributing to its camera fit. */
export function studioGround(light: ReturnType<typeof createStudioLight>, backdrop = false) {
	const receiver = new MeshBasicNodeMaterial({ transparent: !backdrop, depthWrite: true });
	if (backdrop) {
		const seam = uv().x.add(uv().y.mul(0.32)).smoothstep(0.64, 0.645);
		receiver.colorNode = light.shade(mix(color('#85979b'), color('#d9d0bf'), seam));
	} else {
		receiver.colorNode = light.shadowTone;
		receiver.opacityNode = light.opacity;
	}
	const floor = new Mesh(new PlaneGeometry(1, 1), receiver);
	floor.rotation.x = -Math.PI / 2;
	floor.receiveShadow = true;
	floor.visible = false;
	const center = new Vector3();
	const size = new Vector3();
	return {
		floor,
		frame(bounds: Box3) {
			floor.visible = !bounds.isEmpty();
			if (!floor.visible) return;
			bounds.getCenter(center);
			const span = Math.max(2, bounds.getSize(size).length()) * 6;
			floor.scale.set(span, span, 1);
			floor.position.set(center.x, bounds.min.y - 0.006, center.z);
		},
		dispose() {
			floor.geometry.dispose();
			floor.material.dispose();
		}
	};
}
