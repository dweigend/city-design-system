import * as THREE from 'three/webgpu';
import { float, mix, output, shadow, texture, uniform, vec2, vec4 } from 'three/tsl';
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
	const stride = uniform(config.radius / config.shadowSize);
	// A stationary tent avoids rotating a sparse PCF kernel across a flat paper face.
	const offsets = config.shadowTaps === 4 ? [-0.5, 0.5] : [-0.75, 0, 0.75];
	function filterNode({
		depthTexture,
		shadowCoord
	}: {
		depthTexture: THREE.DepthTexture;
		shadowCoord: THREE.Node<'vec3'>;
	}) {
		let result: THREE.Node<'float'> = float(0);
		let total = 0;
		for (const x of offsets)
			for (const y of offsets) {
				const weight = (x === 0 ? 2 : 1) * (y === 0 ? 2 : 1);
				const coord = shadowCoord.xy.add(vec2(x, y).mul(stride));
				result = result.add(
					texture<'float'>(depthTexture, coord).compare(shadowCoord.z).mul(weight)
				);
				total += weight;
			}
		return result.div(total);
	}
	Object.assign(sun.shadow, { filterNode });
	// Three's depth-only shadow node returns a scalar, but its type omits the TSL scalar interface.
	const shadowMask = shadow(sun) as ReturnType<typeof shadow> & THREE.Node<'float'>;
	// Both physical receivers and the paper shader sample the same cached depth target.
	Object.assign(sun.shadow, { shadowNode: shadowMask });
	const tint = new THREE.Color(config.shadowTint);
	const shadowTone = uniform(new THREE.Vector3(tint.r, tint.g, tint.b));
	const opacity = float(shadowMask).oneMinus().mul(config.shadowOpacity);
	const shade = (color: THREE.Node<'vec3'>) => mix(color, shadowTone, opacity);
	function aimKey(
		target: THREE.Vector3,
		width: number,
		height: number,
		reach: number,
		resolution: number,
		radius: number
	) {
		const camera = sun.shadow.camera;
		const far = 4 * reach + 4;
		if (
			camera.right === width &&
			camera.top === height &&
			camera.far === far &&
			sun.shadow.mapSize.width === resolution &&
			target.equals(sun.target.position)
		)
			return;
		sun.shadow.needsUpdate = true;
		sun.shadow.mapSize.set(resolution, resolution);
		sun.shadow.radius = radius;
		stride.value = radius / resolution;
		const texel = (2 * Math.max(width, height)) / resolution;
		sun.shadow.normalBias = Math.min(0.06, texel * 0.6);
		sun.target.position.copy(target);
		sun.position.copy(target).addScaledVector(studioKeyDirection, 2 * reach + 2);
		camera.left = -width;
		camera.right = width;
		camera.bottom = -height;
		camera.top = height;
		camera.near = 1;
		camera.far = far;
		camera.updateProjectionMatrix();
	}

	return {
		shadowTone,
		opacity,
		objects: [sun, sun.target, fill],
		shade,
		// The caster derives opacity from colorNode.a. Only the beauty pass may sample shadow depth.
		receiverOutput: vec4(shade(output.rgb), output.a),
		/** Caps the studio's warm grey against the current paper, including night palettes. */
		setPaper(paper: THREE.Color) {
			shadowTone.value.set(
				Math.min(tint.r, paper.r),
				Math.min(tint.g, paper.g),
				Math.min(tint.b, paper.b)
			);
		},
		/** Releases the shadow render target. */
		dispose: () => shadowMask.dispose(),
		/** Rebuilds the shadow map when its casters or its camera move. */
		refresh() {
			sun.shadow.needsUpdate = true;
		},
		/** Covers the town viewport, including casters beside the visible ground. */
		aim(target: THREE.Vector3, span: number) {
			const reach = Math.max(2, span * 1.1);
			aimKey(target, reach, reach, reach, config.shadowSize, config.radius);
		},
		/** Fits both light-space axes to the subject. A projected cast shadow shares its caster's coordinates. */
		frame(bounds: THREE.Box3) {
			if (bounds.isEmpty()) return;
			const half = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
			const right = sun.shadow.camera.up.clone().cross(studioKeyDirection).normalize();
			const up = studioKeyDirection.clone().cross(right);
			const extent = (axis: THREE.Vector3) =>
				Math.max(
					0.25,
					1.08 * (half.x * Math.abs(axis.x) + half.y * Math.abs(axis.y) + half.z * Math.abs(axis.z))
				);
			const width = extent(right),
				height = extent(up);
			const texel = (2 * Math.max(width, height)) / config.modelShadowSize;
			const radius = THREE.MathUtils.clamp(0.1 / texel, config.radius, 14);
			aimKey(
				bounds.getCenter(new THREE.Vector3()),
				width,
				height,
				Math.max(2, half.length() * 2),
				config.modelShadowSize,
				radius
			);
		}
	};
}
