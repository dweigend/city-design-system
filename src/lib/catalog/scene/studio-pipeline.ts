import { metallUmgebung } from './materialMetallUmgebung';
import * as THREE from 'three/webgpu';
import { mix, pass, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

export const studioKeyDirection = new THREE.Vector3(-0.85, 0.85, 0.25).normalize();

/** Upper-left key and broad sky/ground bounce for physical materials. */
export function studioLights() {
	const key = new THREE.DirectionalLight(0xfff1de, 2.2);
	key.position.copy(studioKeyDirection);
	const fill = new THREE.HemisphereLight(0xf3f6ff, 0xe8d8bd, 1.65);
	return { key, fill };
}

/** Owns color conversion, multisampled scene depth and contact shading in scene metres. */
export function studioPipeline(
	renderer: THREE.WebGPURenderer,
	scene: THREE.Scene,
	camera: THREE.Camera
) {
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
	renderer.shadowMap.type = THREE.PCFShadowMap;
	const environment = metallUmgebung('studio');
	scene.environment = environment;
	scene.environmentIntensity = 0.32;
	const beauty = pass(scene, camera);
	const face = beauty.getTextureNode();
	// @ts-expect-error GTAONode accepts null to reconstruct normals from depth (three r187).
	const contact = ao(beauty.getTextureNode('depth'), null, camera);
	contact.resolutionScale = 0.5;
	contact.samples.value = 12;
	contact.radius.value = 2.4;
	contact.thickness.value = 0.9;
	const pipeline = new THREE.RenderPipeline(renderer);
	pipeline.outputNode = vec4(face.rgb.mul(mix(0.55, 1, contact.getTextureNode().r)), face.a);
	return {
		shadowSize: 2048,
		render: () => pipeline.render(),
		dispose() {
			pipeline.dispose();
			contact.dispose();
			beauty.dispose();
			scene.environment = null;
			environment.dispose();
		}
	};
}
