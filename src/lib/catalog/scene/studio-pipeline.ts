import * as THREE from 'three/webgpu';
import { mix, pass, vec4 } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';

const profiles = {
	phone: { ratio: 1, resolution: 0.5, samples: 8, shadowSize: 1024 },
	desktop: { ratio: 1.5, resolution: 0.5, samples: 16, shadowSize: 2048 },
	high: { ratio: 2, resolution: 1, samples: 24, shadowSize: 4096 }
};
export type StudioQuality = keyof typeof profiles;

/** Resolves a repeatable preview preset from the URL or the device's primary pointer. */
function studioQuality(): StudioQuality {
	const requested = new URLSearchParams(location.search).get('quality');
	if (requested === 'phone' || requested === 'high' || requested === 'desktop') return requested;
	return matchMedia('(pointer: coarse)').matches ? 'phone' : 'desktop';
}

/** Upper-left key and broad sky/ground bounce for physical materials. */
export function studioLights() {
	const key = new THREE.DirectionalLight(0xfff1de, 2.2);
	key.position.set(-0.85, 0.85, 0.25);
	const fill = new THREE.HemisphereLight(0xf3f6ff, 0xe8d8bd, 1.65);
	return { key, fill };
}

/** Owns color conversion, multisampled scene depth and contact shading in scene metres. */
export function studioPipeline(
	renderer: THREE.WebGPURenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	quality: StudioQuality = studioQuality()
) {
	const profile = profiles[quality];
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, profile.ratio));
	renderer.shadowMap.type = THREE.PCFShadowMap;
	const beauty = pass(scene, camera);
	const face = beauty.getTextureNode();
	// @ts-expect-error GTAONode accepts null to reconstruct normals from depth (three r187).
	const contact = ao(beauty.getTextureNode('depth'), null, camera);
	contact.resolutionScale = profile.resolution;
	contact.samples.value = profile.samples;
	contact.radius.value = 2.4;
	contact.thickness.value = 0.9;
	const pipeline = new THREE.RenderPipeline(renderer);
	pipeline.outputNode = vec4(face.rgb.mul(mix(0.55, 1, contact.getTextureNode().r)), face.a);
	return {
		shadowSize: profile.shadowSize,
		render: () => pipeline.render(),
		dispose() {
			pipeline.dispose();
			contact.dispose();
			beauty.dispose();
		}
	};
}
