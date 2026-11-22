import * as Three from 'three/webgpu';
import { OrthographicCamera, PerspectiveCamera, WebGLRenderer } from 'three';

export function createStage() {
	const gpu = new Three.WebGPURenderer();
	const gl = new WebGLRenderer();
	const perspective = new PerspectiveCamera();
	const orthographic = new OrthographicCamera();
	gpu.setAnimationLoop(() => undefined);
	requestAnimationFrame(() => undefined);
	return { gpu, gl, perspective, orthographic };
}
