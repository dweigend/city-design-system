import * as Three from 'three/webgpu';
import { OrthographicCamera, PerspectiveCamera as Look, WebGLRenderer } from 'three';

const { PerspectiveCamera: Lens } = Three;
const Ortho = Three['OrthographicCamera'];

export function createStage() {
	const gpu = new Three.WebGPURenderer();
	const gl = new WebGLRenderer();
	const perspective = new Look();
	const lens = new Lens();
	const overhead = new Ortho();
	const orthographic = new OrthographicCamera();
	gpu.setAnimationLoop(() => undefined);
	requestAnimationFrame(() => undefined);
	return { gpu, gl, perspective, orthographic, lens, overhead };
}
