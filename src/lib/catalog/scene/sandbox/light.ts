import * as THREE from 'three/webgpu';
import { float, mix, shadow, uniform } from 'three/tsl';
import { studioLights } from '../studio-pipeline';

const SHADOW_MAP_SIZE = 4096;
/** Smallest half width of the shadow volume, meters, and its factor of the visible span. */
const SHADOW_REACH = { min: 120, perSpan: 1.1 };

/** Fits a directional shadow to the scene without shading the paper with ambient light. */
export function createLight(shadowSize = SHADOW_MAP_SIZE, minReach = SHADOW_REACH.min) {
	const { key: sun, fill } = studioLights();
	const direction = sun.position.clone().normalize();
	sun.castShadow = true;
	sun.shadow.autoUpdate = false;
	sun.shadow.mapSize.set(shadowSize, shadowSize);
	sun.shadow.needsUpdate = true;
	sun.shadow.bias = -0.0006;
	sun.shadow.camera.up.set(0, 0, 1);
	sun.shadow.radius = 2.5;
	// Three's depth-only shadow node returns a scalar, but its type omits the TSL scalar interface.
	const shadowMask = shadow(sun) as ReturnType<typeof shadow> & THREE.Node<'float'>;
	// Both physical receivers and the paper shader sample the same cached depth target.
	Object.assign(sun.shadow, { shadowNode: shadowMask });
	const shadowTone = uniform(new THREE.Vector3());
	return {
		objects: [sun, sun.target, fill],
		/** The ground holds the paper palette outside the cast shadow. */
		shade(this: void, color: THREE.Node<'vec3'>) {
			return mix(color, shadowTone, float(shadowMask).oneMinus().mul(0.62));
		},
		/** Sets the ground shadow tint. The optional paper caps callers using the drawing shadow tone. */
		setTone(color: THREE.Color, paper = color) {
			shadowTone.value.set(
				Math.min(color.r, paper.r),
				Math.min(color.g, paper.g),
				Math.min(color.b, paper.b)
			);
		},
		/** Releases the shadow render target. */
		dispose: () => shadowMask.dispose(),
		/** Rebuilds the shadow map when its casters or its camera move. */
		refresh() {
			sun.shadow.needsUpdate = true;
		},
		/** Fits the shadow volume to the visible stage in metres. */
		aim(target: THREE.Vector3, span: number) {
			const reach = Math.max(minReach, span * SHADOW_REACH.perSpan);
			const shadowCamera = sun.shadow.camera;
			if (shadowCamera.right === reach && target.equals(sun.target.position)) return;
			sun.shadow.needsUpdate = true;
			sun.target.position.copy(target);
			sun.position.copy(target).addScaledVector(direction, 900);
			shadowCamera.left = shadowCamera.bottom = -reach;
			shadowCamera.right = shadowCamera.top = reach;
			shadowCamera.near = 1;
			shadowCamera.far = 2400;
			shadowCamera.updateProjectionMatrix();
		}
	};
}
