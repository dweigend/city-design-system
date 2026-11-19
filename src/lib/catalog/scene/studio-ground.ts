import { Box3, Mesh, PlaneGeometry, ShadowNodeMaterial, Vector3 } from 'three/webgpu';

/** Fits a shadow-only paper floor beneath a model without contributing to its camera fit. */
export function studioGround() {
	const floor = new Mesh(
		new PlaneGeometry(1, 1),
		new ShadowNodeMaterial({
			color: 0x6b6359,
			opacity: 0.55,
			depthWrite: true
		})
	);
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
