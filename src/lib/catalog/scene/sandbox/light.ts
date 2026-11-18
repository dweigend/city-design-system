import * as THREE from 'three/webgpu';

/**
 * Light of the white model. A surface that faces up shows its own color unchanged;
 * surfaces turned away or in shadow fall toward the ambient share.
 */
const LIGHT = { ambient: 0.72, sunAzimuthRad: -0.75, sunElevationRad: 0.8 };
const SHADOW_MAP_SIZE = 4096;
/** Smallest half width of the shadow volume, meters, and its factor of the visible span. */
const SHADOW_REACH = { min: 120, perSpan: 1.1 };

/** Creates sun and ambient light. `aim` fits the shadow volume to the visible ground. */
export function createLight() {
	const direction = new THREE.Vector3(
		Math.sin(LIGHT.sunAzimuthRad) * Math.cos(LIGHT.sunElevationRad),
		Math.sin(LIGHT.sunElevationRad),
		Math.cos(LIGHT.sunAzimuthRad) * Math.cos(LIGHT.sunElevationRad)
	);
	// Lambert divides by π: intensities carry it, so a ground facing up reads as its own color.
	const ambient = new THREE.AmbientLight(0xffffff, Math.PI * LIGHT.ambient);
	const sun = new THREE.DirectionalLight(0xffffff, (Math.PI * (1 - LIGHT.ambient)) / direction.y);
	sun.castShadow = true;
	sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
	sun.shadow.bias = -0.0006;
	sun.shadow.normalBias = 0.05;
	return {
		objects: [ambient, sun, sun.target],
		/** Centers the shadow volume on the view target; sharp shadows at every zoom. */
		aim(target: THREE.Vector3, span: number) {
			const reach = Math.max(SHADOW_REACH.min, span * SHADOW_REACH.perSpan);
			sun.target.position.copy(target);
			sun.position.copy(target).addScaledVector(direction, 900);
			const shadowCamera = sun.shadow.camera;
			shadowCamera.left = shadowCamera.bottom = -reach;
			shadowCamera.right = shadowCamera.top = reach;
			shadowCamera.near = 1;
			shadowCamera.far = 2400;
			shadowCamera.updateProjectionMatrix();
		}
	};
}
