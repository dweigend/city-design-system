import * as Three from 'three/webgpu';
import Device from 'three/src/renderers/webgpu/WebGPURenderer.js';
import { OrthographicCamera, PerspectiveCamera as Look, WebGLRenderer } from 'three';

const { PerspectiveCamera: Lens } = Three;
const Ortho = Three['OrthographicCamera'];

export function createStage() {
	const gpu = new Three.WebGPURenderer();
	const device = new Device();
	const gl = new WebGLRenderer();
	const perspective = new Look();
	const lens = new Lens();
	const overhead = new Ortho();
	const orthographic = new OrthographicCamera();
	gpu.setAnimationLoop(() => undefined);
	requestAnimationFrame(() => undefined);
	return { gpu, device, gl, perspective, orthographic, lens, overhead };
}
