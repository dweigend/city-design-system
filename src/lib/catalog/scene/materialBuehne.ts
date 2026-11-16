import * as THREE from 'three/webgpu';
import { float, uv } from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { bindSceneTheme } from './themeBinding';
import { kantenfarbe, rezeptMaterial } from './materialRezept';
import type { Palette3D } from '../data/city3d';
import type { Stueck, Teil } from '../logic/material/formen';

/**
 * Stage of the material page: shows pieces (part + recipe) with three.js, WebGPU with a
 * WebGL 2 fallback. Parallel projection, no light: tone, gloss, and turbidity come from the recipe (TSL).
 * Straight edges as lines, round outlines in the shader. A soft ground spot anchors every form.
 * Draws only on change; animated materials (water) run while the stage is visible
 * and reduced motion is not requested.
 * Axes: model x → three x, model y → three −z, model z → three y.
 */
export type MaterialBuehne = {
	ready: Promise<void>;
	zeige(stuecke: Stueck[]): void;
	resize(widthPx: number, heightPx: number): void;
	/** Visible in the viewport: only then do animated materials run. */
	setAktiv(aktiv: boolean): void;
	zuruecksetzen(): void;
	dispose(): void;
};

export type BuehnenOptionen = {
	drehen?: boolean;
	/** View: elevation above the horizon and direction in degrees. */
	hoeheDeg?: number;
	azimutDeg?: number;
	/** Margin around the scene as a share of its size. */
	rand?: number;
	/** Let animated materials run (otherwise time stops at the first frame). */
	bewegung?: boolean;
	onError?: () => void;
};

type Eintrag = { key: string; gruppe: THREE.Group };

function geometrie(t: Teil): THREE.BufferGeometry {
	const [a, b, c] = t.mass;
	switch (t.art) {
		case 'quader':
			return new THREE.BoxGeometry(a, c, b).translate(0, c / 2, 0);
		case 'zylinder':
			return new THREE.CylinderGeometry(a, a, c, 72, 1).translate(0, c / 2, 0);
		case 'kuppel':
			return new THREE.SphereGeometry(a, 72, 36, 0, Math.PI * 2, 0, Math.PI / 2);
		case 'kugel':
			return new THREE.SphereGeometry(a, 72, 48).translate(0, a, 0);
	}
}

/** Expands `box` by the hull of a part (three axes). */
function huelle(t: Teil, box: THREE.Box3) {
	const [x, y, z] = t.lage;
	const r = t.mass[0];
	const w = t.art === 'quader' ? t.mass[0] / 2 : r,
		d = t.art === 'quader' ? t.mass[1] / 2 : r;
	const h = t.art === 'kugel' ? 2 * r : t.art === 'kuppel' ? r : t.mass[2];
	box.expandByPoint(new THREE.Vector3(x - w, z, -y - d));
	box.expandByPoint(new THREE.Vector3(x + w, z + h, -y + d));
}

/** Plan radius of a part for the ground spot. */
const radius = (t: Teil) => (t.art === 'quader' ? Math.hypot(t.mass[0], t.mass[1]) / 2 : t.mass[0]);

export function createMaterialBuehne(
	canvas: HTMLCanvasElement,
	optionen: BuehnenOptionen = {}
): MaterialBuehne {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
	const welt = new THREE.Group();
	scene.add(welt);
	const ruhe =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	let alive = true,
		initialized = false,
		aktiv = true,
		width = 1,
		height = 1,
		pending = 0,
		rahmenKey = '',
		halb = 5,
		palette: Palette3D | undefined,
		letzte: Stueck[] = [];
	const eintraege = new Map<string, Eintrag>();
	const materialien = new Map<string, THREE.Material>();

	const controls = optionen.drehen ? new OrbitControls(camera, canvas) : undefined;
	if (controls) {
		controls.enablePan = false;
		controls.enableZoom = true;
		controls.zoomSpeed = 0.8;
		controls.minZoom = 0.6;
		controls.maxZoom = 4;
		controls.minPolarAngle = THREE.MathUtils.degToRad(12);
		controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
		controls.addEventListener('change', () => render());
	}

	/** Keyboard: arrows rotate by 15°, plus and minus zoom, zero resets. */
	function taste(e: KeyboardEvent) {
		if (!controls) return;
		const schritt = THREE.MathUtils.degToRad(15);
		const off = camera.position.clone().sub(controls.target);
		const sph = new THREE.Spherical().setFromVector3(off);
		if (e.key === 'ArrowLeft') sph.theta -= schritt;
		else if (e.key === 'ArrowRight') sph.theta += schritt;
		else if (e.key === 'ArrowUp') sph.phi -= schritt;
		else if (e.key === 'ArrowDown') sph.phi += schritt;
		else if (e.key === '+' || e.key === '=')
			camera.zoom = Math.min(controls.maxZoom, camera.zoom * 1.2);
		else if (e.key === '-') camera.zoom = Math.max(controls.minZoom, camera.zoom / 1.2);
		else if (e.key === '0') return void (kamera(true), render());
		else return;
		e.preventDefault();
		sph.phi = THREE.MathUtils.clamp(sph.phi, controls.minPolarAngle, controls.maxPolarAngle);
		camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
		camera.lookAt(controls.target);
		camera.updateProjectionMatrix();
		controls.update();
		render();
	}
	if (controls) canvas.addEventListener('keydown', taste);

	const bewegt = () =>
		optionen.bewegung !== false && !ruhe && aktiv && letzte.some((s) => s.rezept.haut.bewegt);

	function render() {
		if (!alive || !initialized || pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			if (!alive) return;
			renderer.render(scene, camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
			if (bewegt()) render();
		});
	}

	/** Frame the camera so all parts fit with a margin; only for a new framing. */
	function kamera(ganz: boolean) {
		const polar = THREE.MathUtils.degToRad(90 - (optionen.hoeheDeg ?? 28));
		const az = THREE.MathUtils.degToRad(optionen.azimutDeg ?? 32);
		const box = new THREE.Box3();
		for (const s of letzte) huelle(s.teil, box);
		if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(4, 4, 4));
		const mitte = box.getCenter(new THREE.Vector3());
		if (ganz || !controls) {
			camera.zoom = 1;
			controls?.target.copy(mitte);
			camera.position
				.set(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az))
				.multiplyScalar(100)
				.add(mitte);
			camera.lookAt(mitte);
		}
		// Measure the extent along the view direction: corners into camera space.
		camera.updateMatrixWorld();
		const inv = camera.matrixWorldInverse;
		let bx = 0,
			by = 0;
		for (const x of [box.min.x, box.max.x])
			for (const y of [box.min.y, box.max.y])
				for (const z of [box.min.z, box.max.z]) {
					const p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
					const m = mitte.clone().applyMatrix4(inv);
					bx = Math.max(bx, Math.abs(p.x - m.x));
					by = Math.max(by, Math.abs(p.y - m.y));
				}
		const rand = 1 + (optionen.rand ?? 0.12);
		const a = width / height;
		halb = Math.max(by, bx / a) * rand;
		camera.top = halb;
		camera.bottom = -halb;
		camera.left = -halb * a;
		camera.right = halb * a;
		camera.updateProjectionMatrix();
		controls?.update();
	}

	function materialFuer(s: Stueck) {
		const key = JSON.stringify(s.rezept) + (s.teil.art === 'kuppel' ? '|2' : '');
		let m = materialien.get(key);
		if (!m && palette) {
			m = rezeptMaterial(s.rezept, palette, s.teil.art === 'kuppel');
			materialien.set(key, m);
		}
		return m;
	}

	function fleckMaterial() {
		const key = 'fleck';
		let m = materialien.get(key);
		if (!m && palette) {
			const mb = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
			// Black on any ground; stronger on dark paper so the spot stays legible.
			mb.color = new THREE.Color(0x000000);
			const dunkel = new THREE.Color(palette.paper).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
			const d = uv().sub(0.5).length().mul(2);
			mb.opacityNode = float(1)
				.sub(d.smoothstep(0.35, 1))
				.mul(dunkel ? 0.4 : 0.09);
			m = mb;
			materialien.set(key, m);
		}
		return m;
	}

	function baue(s: Stueck): THREE.Group {
		const gruppe = new THREE.Group();
		const [x, y, z] = s.teil.lage;
		gruppe.position.set(x, z, -y);
		const geo = geometrie(s.teil);
		const mat = materialFuer(s);
		const mesh = new THREE.Mesh(geo, mat);
		const durch = s.rezept.haut.deckkraft < 1;
		mesh.renderOrder = durch ? 3 : 1;
		gruppe.add(mesh);
		if (s.rezept.kante && palette && s.teil.art !== 'kugel') {
			const kanten = new THREE.EdgesGeometry(geo, 25);
			const pos = Array.from(kanten.getAttribute('position').array as Float32Array);
			kanten.dispose();
			const lm = new THREE.Line2NodeMaterial({
				color: kantenfarbe(s.rezept, palette),
				linewidth: 1.15 * s.rezept.kante.breite
			});
			const linie = new LineSegments2(new LineSegmentsGeometry().setPositions(pos), lm);
			linie.renderOrder = 4;
			linie.frustumCulled = false;
			gruppe.add(linie);
		}
		if (z === 0) {
			const r = radius(s.teil) * 1.7;
			const fleck = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), fleckMaterial());
			fleck.rotation.x = -Math.PI / 2;
			fleck.position.y = 0.002;
			fleck.renderOrder = 0;
			gruppe.add(fleck);
		}
		return gruppe;
	}

	function entsorge(g: THREE.Group) {
		g.traverse((o) => {
			if (o instanceof THREE.Mesh || o instanceof LineSegments2) {
				o.geometry.dispose();
				// Surface materials live in the cache; line materials belong to the piece.
				if (o instanceof LineSegments2) (o.material as THREE.Material).dispose();
			}
		});
		welt.remove(g);
	}

	function zeichne() {
		const ids = new Set(letzte.map((s) => s.id));
		for (const [id, e] of eintraege)
			if (!ids.has(id)) {
				entsorge(e.gruppe);
				eintraege.delete(id);
			}
		for (const s of letzte) {
			const key = JSON.stringify(s.teil) + JSON.stringify(s.rezept);
			let e = eintraege.get(s.id);
			if (!e || e.key !== key) {
				if (e) entsorge(e.gruppe);
				e = { key, gruppe: baue(s) };
				eintraege.set(s.id, e);
				welt.add(e.gruppe);
			}
			const k = s.skala ?? 1;
			const sanft = k * k * (3 - 2 * k);
			e.gruppe.scale.setScalar(Math.max(0.0001, sanft));
			e.gruppe.visible = k > 0;
		}
		const neuerRahmen = letzte.map((s) => JSON.stringify(s.teil)).join();
		if (neuerRahmen !== rahmenKey) {
			// New form: look back at the center so it sits fully in frame.
			rahmenKey = neuerRahmen;
			kamera(true);
		}
		render();
	}

	function alleNeu() {
		for (const e of eintraege.values()) entsorge(e.gruppe);
		eintraege.clear();
		for (const m of materialien.values()) m.dispose();
		materialien.clear();
	}

	const ready = renderer
		.init()
		.then(() => {
			initialized = true;
			canvas.dataset.backend =
				'isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend
					? 'webgpu'
					: 'webgl2';
			if (alive) render();
			else renderer.dispose();
		})
		.catch((cause) => {
			if (alive) optionen.onError?.();
			throw cause;
		});

	const stopTheme = bindSceneTheme(canvas, scene, renderer, (p) => {
		palette = p;
		alleNeu();
		zeichne();
	});

	return {
		ready,
		zeige(stuecke) {
			letzte = stuecke;
			zeichne();
		},
		resize(w, h) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			renderer.setSize(width, height, false);
			kamera(false);
			render();
		},
		setAktiv(a) {
			aktiv = a;
			render();
		},
		zuruecksetzen() {
			kamera(true);
			render();
		},
		dispose() {
			alive = false;
			if (pending) cancelAnimationFrame(pending);
			stopTheme();
			canvas.removeEventListener('keydown', taste);
			controls?.dispose();
			alleNeu();
			if (initialized) renderer.dispose();
		}
	};
}
