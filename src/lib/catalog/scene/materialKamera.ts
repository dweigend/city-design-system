import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const STEP = THREE.MathUtils.degToRad(15);
const drehung: Record<string, readonly [number, number]> = {
	ArrowLeft: [-STEP, 0],
	ArrowRight: [STEP, 0],
	ArrowUp: [0, -STEP],
	ArrowDown: [0, STEP]
};
const zoom: Record<string, number> = { '+': 1.2, '=': 1.2, '-': 1 / 1.2 };

function fit(camera: THREE.OrthographicCamera, box: THREE.Box3, aspekt: number, rand: number) {
	camera.updateMatrixWorld();
	const inv = camera.matrixWorldInverse;
	const m = box.getCenter(new THREE.Vector3()).applyMatrix4(inv);
	let xMax = 0;
	let yMax = 0;
	for (const x of [box.min.x, box.max.x])
		for (const y of [box.min.y, box.max.y])
			for (const z of [box.min.z, box.max.z]) {
				const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
				xMax = Math.max(xMax, Math.abs(p.x - m.x));
				yMax = Math.max(yMax, Math.abs(p.y - m.y));
			}
	const halb = Math.max(yMax, xMax / aspekt) * (1 + rand);
	camera.top = halb;
	camera.bottom = -halb;
	camera.left = -halb * aspekt;
	camera.right = halb * aspekt;
	camera.updateProjectionMatrix();
}

function orbit(camera: THREE.OrthographicCamera, canvas: HTMLCanvasElement, redraw: () => void) {
	const control = new OrbitControls(camera, canvas);
	control.enablePan = false;
	control.zoomSpeed = 0.8;
	control.minZoom = 0.6;
	control.maxZoom = 4;
	control.minPolarAngle = THREE.MathUtils.degToRad(12);
	control.maxPolarAngle = THREE.MathUtils.degToRad(84);
	control.addEventListener('change', redraw);
	return control;
}

function drehen(control: OrbitControls, [azimut, polar]: readonly [number, number]) {
	const p = control.object.position;
	const s = new THREE.Spherical().setFromVector3(p.clone().sub(control.target));
	s.theta += azimut;
	s.phi = THREE.MathUtils.clamp(s.phi + polar, control.minPolarAngle, control.maxPolarAngle);
	p.setFromSpherical(s).add(control.target);
}

/** Orthographic stage view and optional keyboard/pointer controls. Dispose with its canvas. */
export function createMaterialKamera(
	canvas: HTMLCanvasElement,
	{ drehen: steuerbar = false, hoeheDeg = 28, azimutDeg = 32, rand = 0.12 },
	redraw: () => void
) {
	const kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
	const polar = THREE.MathUtils.degToRad(90 - hoeheDeg);
	const azimut = THREE.MathUtils.degToRad(azimutDeg);
	const richtung = new THREE.Vector3().setFromSphericalCoords(100, polar, azimut);
	const control = steuerbar ? orbit(kamera, canvas, redraw) : undefined;
	const box = new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2));
	let aspekt = 1;

	function reset() {
		kamera.zoom = 1;
		const mitte = box.getCenter(new THREE.Vector3());
		control?.target.copy(mitte);
		kamera.position.copy(mitte).add(richtung);
		kamera.lookAt(mitte);
		fit(kamera, box, aspekt, rand);
		control?.update();
		redraw();
	}

	function bedienen(steuerung: OrbitControls, key: string) {
		const winkel = drehung[key];
		const faktor = zoom[key];
		if (key === '0') reset();
		else if (winkel) drehen(steuerung, winkel);
		else if (faktor) {
			kamera.zoom = THREE.MathUtils.clamp(
				kamera.zoom * faktor,
				steuerung.minZoom,
				steuerung.maxZoom
			);
			kamera.updateProjectionMatrix();
		} else return false;
		return true;
	}

	function taste(event: KeyboardEvent) {
		if (!control || !bedienen(control, event.key)) return;
		event.preventDefault();
		control.update();
		redraw();
	}

	if (control) canvas.addEventListener('keydown', taste);
	return {
		kamera,
		/** Frame model bounds in meters and restore the initial view. */
		frame(bounds: THREE.Box3) {
			box.copy(bounds);
			reset();
		},
		/** Change the projection aspect without resetting orbit or zoom. */
		resize(a: number) {
			aspekt = a;
			fit(kamera, box, aspekt, rand);
			control?.update();
		},
		reset,
		/** Release listeners owned by this view. */
		dispose() {
			canvas.removeEventListener('keydown', taste);
			control?.dispose();
		}
	};
}
