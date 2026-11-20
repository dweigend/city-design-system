import { metallUmgebung } from './materialMetallUmgebung';
import * as THREE from 'three/webgpu';
import { color, mix, mrt, normalWorldGeometry, output, pass, uniform, vec3, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

import { createStudioLight } from './studio-light';
import { contactInk, studioConfig, studioQuality } from './studio-quality';

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
	// Scaffold lines and joint hardware have no receiving surface. Carry the receiver
	// flag with the beauty sample so a nearby occluder cannot darken their pixels.
	const receiver = uniform(0).onObjectUpdate(({ object }) => (object?.receiveShadow ? 1 : 0));
	const mask = receiver.mul(normalWorldGeometry.y.smoothstep(0.45, 0.8));
	const outputs = mrt({ output, bearing: vec4(vec3(mask), output.a) });
	outputs.setBlendMode('bearing', outputs.getBlendMode('output'));
	beauty.setMRT(outputs);
	beauty.getTexture('bearing').type = THREE.UnsignedByteType;
	const bearing = beauty.getTextureNode('bearing');
	// @ts-expect-error GTAONode accepts null to reconstruct normals from depth (three r187).
	const contact = ao(beauty.getTextureNode('depth'), null, camera);
	contact.resolutionScale = config.aoScale;
	contact.samples.value = config.aoSamples;
	contact.radius.value = 0.8;
	contact.scale.value = 2.4;
	contact.thickness.value = 0.7;
	const pipeline = new THREE.RenderPipeline(renderer);
	const buffer = new THREE.Vector2();
	// Bring shallow deck and kerb contacts into the print without increasing the darkest joint.
	const occlusion = contact.getTextureNode().r.oneMinus().clamp(0, 1).pow(0.68);
	const opacity = occlusion.mul(bearing.r).mul(contactInk.opacity);
	const shaded = mix(face.rgb, face.rgb.mul(color(contactInk.color)), opacity);
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
