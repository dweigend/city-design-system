import { expect, test } from 'bun:test';
import {
	GLSLNodeBuilder,
	Mesh,
	MeshBasicNodeMaterial,
	OrthographicCamera,
	PlaneGeometry,
	Scene,
	WebGPURenderer,
	type Node
} from 'three/webgpu';
import { positionWorld, vec3, vec4 } from 'three/tsl';
import { holzMuster } from './materialHolzMuster';
import { pressedFlakes } from './toy-surfaces';

function fragment(expression: Node<'vec3'>) {
	const renderer = new WebGPURenderer({ forceWebGL: true, canvas: {} as HTMLCanvasElement });
	Object.assign(renderer, { _bindings: undefined, hasFeature: () => false });
	Object.assign(renderer.backend, { extensions: { has: () => false } });
	const material = new MeshBasicNodeMaterial();
	material.fragmentNode = vec4(expression, 1);
	const geometry = new PlaneGeometry();
	const builder = new GLSLNodeBuilder(new Mesh(geometry, material), renderer) as GLSLNodeBuilder & {
		context: { material: MeshBasicNodeMaterial };
		build(): void;
		fragmentShader: string;
	};
	Object.assign(builder, { scene: new Scene(), camera: new OrthographicCamera() });
	builder.context.material = material;
	builder.build();
	geometry.dispose();
	material.dispose();
	return builder.fragmentShader;
}

test('WebGL grain colour fades with pixel size and relief heights can be differentiated once', () => {
	const base = vec3(0.5);
	const space = { welt: positionWorld, lokal: positionWorld };
	const derivatives = /\b(?:fwidth|dFdx|dFdy)\s*\(/;
	for (const finish of [
		pressedFlakes(base, positionWorld),
		holzMuster(base, false, space),
		holzMuster(base, true, space)
	]) {
		expect(fragment(finish.farbe)).toMatch(derivatives);
		expect(fragment(vec3(finish.hoehe))).not.toMatch(derivatives);
	}
});
