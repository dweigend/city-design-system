import { metallUmgebung } from './materialMetallUmgebung';
import * as THREE from 'three/webgpu';
import { mix, pass, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

import { createStudioLight } from './studio-light';
import { studioConfig, studioQuality } from './studio-quality';

/** Owns color conversion, multisampled scene depth and contact shading in scene metres. */
export function studioPipeline(
	renderer: THREE.WebGPURenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	quality = studioQuality()
) {
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
	const config = studioConfig(quality);
	const light = createStudioLight(config);
	scene.add(...light.objects);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	const environment = metallUmgebung('studio');
	scene.environment = environment;
	scene.environmentIntensity = 0.32;
	const beauty = pass(scene, camera);
	const face = beauty.getTextureNode();
	// @ts-expect-error GTAONode accepts null to reconstruct normals from depth (three r187).
	const contact = ao(beauty.getTextureNode('depth'), null, camera);
	contact.resolutionScale = config.aoScale;
	contact.samples.value = config.aoSamples;
	contact.radius.value = 0.8;
	contact.scale.value = 2.4;
	contact.thickness.value = 0.7;
	const pipeline = new THREE.RenderPipeline(renderer);
	const buffer = new THREE.Vector2();
	const shaded = face.rgb.mul(mix(0.22, 1, contact.getTextureNode().r));
	pipeline.outputNode = vec4(shaded, face.a);
	return {
		light,
		render() {
			if (camera instanceof THREE.OrthographicCamera) {
				renderer.getDrawingBufferSize(buffer);
				const pixel = (camera.top - camera.bottom) / (camera.zoom * Math.max(1, buffer.y));
				const close = 1 - THREE.MathUtils.smoothstep(pixel, 0.04, 0.12);
				const scale = Math.min(1, config.aoScale * (pixel < 0.08 ? 1.5 : 1));
				contact.resolutionScale = scale;
				const radius = THREE.MathUtils.clamp((3 * pixel) / scale, 0.55 - 0.23 * close, 1.65);
				contact.radius.value = radius;
				contact.thickness.value = radius * 0.85;
				contact.scale.value = 2.4 + 0.8 * close;
			}
			pipeline.render();
		},
		dispose() {
			pipeline.dispose();
			scene.remove(...light.objects);
			light.dispose();
			contact.dispose();
			beauty.dispose();
			scene.environment = null;
			environment.dispose();
		}
	};
}
