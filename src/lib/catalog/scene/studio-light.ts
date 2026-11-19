import * as THREE from 'three/webgpu';
import { float, mix, shadow, uniform } from 'three/tsl';
import { studioConfig } from './studio-quality';

export const studioKeyDirection = new THREE.Vector3(-0.85, 0.85, 0.25).normalize();

/** Fits a directional shadow to the scene without shading the paper with ambient light. */
export function createStudioLight(config = studioConfig()) {
	const sun = new THREE.DirectionalLight(config.key, config.intensity);
	const fill = new THREE.HemisphereLight(config.sky, config.ground, config.bounce);
	sun.position.copy(studioKeyDirection);
	sun.castShadow = true;
	sun.shadow.autoUpdate = false;
	sun.shadow.mapSize.set(config.shadowSize, config.shadowSize);
	sun.shadow.needsUpdate = true;
	sun.shadow.bias = config.bias;
	sun.shadow.camera.up.set(0, 0, 1);
	sun.shadow.radius = config.radius;
	// Three's depth-only shadow node returns a scalar, but its type omits the TSL scalar interface.
	const shadowMask = shadow(sun) as ReturnType<typeof shadow> & THREE.Node<'float'>;
	// Both physical receivers and the paper shader sample the same cached depth target.
	Object.assign(sun.shadow, { shadowNode: shadowMask });
	const tint = new THREE.Color(config.shadowTint);
	const shadowTone = uniform(new THREE.Vector3(tint.r, tint.g, tint.b));
	const opacity = float(shadowMask).oneMinus().mul(config.shadowOpacity);
	return {
		shadowTone,
		opacity,
		objects: [sun, sun.target, fill],
		/** The ground holds the paper palette outside the cast shadow. */
		shade(this: void, color: THREE.Node<'vec3'>) {
			return mix(color, shadowTone, opacity);
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
			const reach = Math.max(2, span * 1.1);
			const shadowCamera = sun.shadow.camera;
			if (shadowCamera.right === reach && target.equals(sun.target.position)) return;
			sun.shadow.needsUpdate = true;
			sun.target.position.copy(target);
			sun.position.copy(target).addScaledVector(studioKeyDirection, 2 * reach + 2);
			shadowCamera.left = shadowCamera.bottom = -reach;
			shadowCamera.right = shadowCamera.top = reach;
			shadowCamera.near = 1;
			shadowCamera.far = 4 * reach + 4;
			shadowCamera.updateProjectionMatrix();
		}
	};
}
