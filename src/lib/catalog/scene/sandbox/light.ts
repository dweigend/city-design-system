import * as THREE from 'three/webgpu';
import { float, mix, shadow, uniform } from 'three/tsl';
import { LICHT } from '../../data/leitstil';

const SHADOW_MAP_SIZE = 4096;
/** Smallest half width of the shadow volume, meters, and its factor of the visible span. */
const SHADOW_REACH = { min: 120, perSpan: 1.1 };

/** Fits a directional shadow to the scene without shading the paper with ambient light. */
export function createLight() {
	const direction = new THREE.Vector3(-LICHT[0], -LICHT[2], LICHT[1]).normalize();
	const sun = new THREE.DirectionalLight(0xffffff);
	sun.castShadow = true;
	sun.shadow.autoUpdate = false;
	sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
	sun.shadow.bias = -0.0006;
	sun.shadow.normalBias = 0.05;
	// Three's depth-only shadow node returns a scalar, but its type omits the TSL scalar interface.
	const shadowMask = shadow(sun) as ReturnType<typeof shadow> & THREE.Node<'float'>;
	const shadowTone = uniform(new THREE.Vector3());
	return {
		objects: [sun, sun.target],
		/** The ground holds the paper palette outside the cast shadow. */
		shade(color: THREE.Node<'vec3'>) {
			return mix(shadowTone, color, float(shadowMask));
		},
		/** Sets the Leitstil shadow tone, capped at the paper color so it cannot lighten it. */
		setTone(color: THREE.Color, paper: THREE.Color) {
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
