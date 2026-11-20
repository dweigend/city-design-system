import { expect, test } from 'bun:test';
import {
	BoxGeometry,
	DirectionalLight,
	GLSLNodeBuilder,
	LightsNode,
	Mesh,
	NodeMaterial,
	OrthographicCamera,
	PCFShadowMap,
	Scene,
	WebGPURenderer,
	type Texture
} from 'three/webgpu';
import { createStudioLight } from '../studio-light';
import { loadStructureModules } from './fixtures/structure-modules';

// The WebGL backend builds its real GLSL and sampler bindings without submitting a draw.
function sampledTextures(renderer: WebGPURenderer, material: NodeMaterial) {
	const object = new Mesh(new BoxGeometry(), material);
	const builder = new GLSLNodeBuilder(object, renderer) as GLSLNodeBuilder & {
		context: { material: NodeMaterial };
		build(): void;
		getBindings(): { bindings: { texture?: Texture }[] }[];
	};
	Object.assign(builder, {
		scene: new Scene(),
		camera: new OrthographicCamera(),
		lightsNode: new LightsNode()
	});
	builder.context.material = material;
	builder.build();
	const groups = builder.getBindings();
	object.geometry.dispose();
	return groups.flatMap((g) => g.bindings.flatMap((b) => b.texture ?? []));
}

test('pencil stock samples the studio shadow only when its depth target is read-only', async () => {
	const [{ structureMaterials }] = await loadStructureModules();
	const renderer = new WebGPURenderer({ forceWebGL: true, canvas: {} as HTMLCanvasElement });
	Object.assign(renderer, {
		_bindings: undefined,
		hasFeature: () => false,
		hasCompatibility: (name: string) =>
			Reflect.get(renderer.backend, 'hasCompatibility').call(renderer.backend, name)
	});
	Object.assign(renderer.backend, { extensions: { has: () => false } });
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFShadowMap;
	const light = createStudioLight();
	const pool = structureMaterials('desktop', true, light.receiverOutput);
	const sun = light.objects.find((o): o is DirectionalLight => o instanceof DirectionalLight);
	if (!sun) throw Error('Missing studio key');
	try {
		for (const face of [pool.materials.stock, pool.materials.stockSheet]) {
			const beautyInputs = sampledTextures(renderer, face);
			const attachment = sun.shadow.map?.depthTexture;
			if (!attachment) throw Error('Missing shadow depth attachment');
			expect(beautyInputs).toContain(attachment);
			// r187 derives the caster alpha from the receiving material's colorNode.
			const caster = new NodeMaterial();
			caster.colorNode = Reflect.get(renderer, '_getShadowNodes').call(renderer, face).colorNode;
			expect(sampledTextures(renderer, caster)).not.toContain(attachment);
			caster.dispose();
		}
	} finally {
		pool.dispose();
		light.dispose();
	}
});
