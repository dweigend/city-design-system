import { bindSceneTheme, resolveTokens } from './themeBinding';
/**
 * Color lab in three.js: projects model and coloring from logic/farbe/farblabor.ts.
 * Packets travel out and back on every path: the cycle is a property of every flow.
 * All boxes of a pass share one geometry (InstancedMesh): one call for opaque parts,
 * one for translucent parts, one for the background envelope, one for edges, one for packets. Colors arrive only as
 * resolved tokens (resolveTokens in scene/themeBinding.ts); no color value lives here.
 * Own axis space (PE-3): model x → three x, model y → three z, model z → three y (determinant −1).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
	laborTokens,
	aktiveWege,
	faerbe,
	paketToken,
	type Ansicht,
	type Faerbung
} from '../logic/farbe/farblabor';
import type { Modell, Vec3 } from '../logic/farbe/quartier';
import { pakete, paketLage } from '../logic/farbe/pakete';
import { createKanten } from './kanten';

export type Tokens = Record<string, string>;

/** Image width in meters: the district fills the stage at any width. */
const SICHT_M = 92;
const ELEVATION = Math.PI / 6;
const PAKET = 0.9;
/** Paketgeschwindigkeit in m/s. */
const TEMPO = 3;

const toThree = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, y);

export type FarbLabor = {
	update(ansicht: Ansicht, tokens: Tokens, alpha: Record<string, number>): void;
	setLight(azimuth: number): void;
	setAnimated(on: boolean): void;
	resize(width: number, height: number): void;
	reset(): void;
	info(): { calls: number; triangles: number; instances: number };
	dispose(): void;
};

export function createFarbLabor(canvas: HTMLCanvasElement, modell: Modell): FarbLabor {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	const scene = new THREE.Scene();

	// Orthographic isometric camera (azimuth 45°, elevation 30°).
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 1000);
	const target = new THREE.Vector3(19, 27, 14);
	const home = () => {
		const d = 200;
		camera.position.set(
			target.x + d * Math.cos(ELEVATION) * Math.SQRT1_2,
			target.y + d * Math.sin(ELEVATION),
			target.z + d * Math.cos(ELEVATION) * Math.SQRT1_2
		);
		camera.zoom = 1;
		camera.lookAt(target);
	};
	home();
	const controls = new OrbitControls(camera, canvas);
	controls.target.copy(target);
	controls.enableDamping = false;
	controls.minPolarAngle = 0.2;
	controls.maxPolarAngle = Math.PI / 2 - 0.05;
	controls.addEventListener('change', () => draw());

	// Light: ambient plus one sun; the sum on the top face ≈ 1 (tone steps, no gloss).
	// three.js divides the Lambert response by π, hence the factors.
	const ambient = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.74 * Math.PI);
	const sun = new THREE.DirectionalLight(0xffffff, 0.3 * Math.PI);
	scene.add(ambient, sun);

	const unit = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
	const teile = modell.teile;
	const n = teile.length;
	const matte = new THREE.MeshLambertMaterial();
	const milchig = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false });
	const glas = new THREE.MeshPhongMaterial({
		transparent: true,
		depthWrite: false,
		shininess: 80
	});
	const solid = new THREE.InstancedMesh(unit, matte, n);
	const clear = new THREE.InstancedMesh<THREE.BoxGeometry, THREE.Material>(unit, milchig, n);
	clear.renderOrder = 1;
	// Background layer: envelope, almost transparent, with its own opacity (--alpha-hull).
	const huellStoff = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false });
	const huelle = new THREE.InstancedMesh(unit, huellStoff, n);
	huelle.renderOrder = 1;
	scene.add(solid, clear, huelle);

	// Edges: one LineSegments geometry with a color per corner, built from the boxes.
	const kanten = createKanten(teile.map((t) => ({ min: toThree(t.min), size: toThree(t.size) })));
	kanten.lines.renderOrder = 2;
	scene.add(kanten.lines);

	// Packets: glowing (unshaded), positions from logic/farbe/pakete.ts.
	const liste = pakete(modell);
	const paketMesh = new THREE.InstancedMesh(
		new THREE.BoxGeometry(PAKET, PAKET, PAKET),
		new THREE.MeshBasicMaterial(),
		liste.length
	);
	paketMesh.renderOrder = 3;
	scene.add(paketMesh);

	// Set the structure once; color and visibility later change only through attributes.
	const m = new THREE.Matrix4();
	const place = (mesh: THREE.InstancedMesh, i: number, show: boolean) => {
		const t = teile[i];
		if (!show) m.makeScale(0, 0, 0);
		else m.compose(toThree(t.min), new THREE.Quaternion(), toThree(t.size));
		mesh.setMatrixAt(i, m);
	};

	let aktiv = new Set<string>();
	let paketFarbe: THREE.Color[] = [];
	let animated = false;
	let frame = 0;
	const start = performance.now();
	const seconds = () => (performance.now() - start) / 1000;

	function placePakete(t: number) {
		const q = new THREE.Quaternion();
		const one = new THREE.Vector3(1, 1, 1);
		liste.forEach((p, i) => {
			const show = aktiv.has(p.weg.id);
			const pos = toThree(paketLage(p, t * TEMPO));
			m.compose(pos, q, show ? one : new THREE.Vector3());
			paketMesh.setMatrixAt(i, m);
			if (show && paketFarbe[i]) paketMesh.setColorAt(i, paketFarbe[i]);
		});
		paketMesh.instanceMatrix.needsUpdate = true;
		if (paketMesh.instanceColor) paketMesh.instanceColor.needsUpdate = true;
	}

	function draw() {
		renderer.render(scene, camera);
	}

	function loop() {
		frame = 0;
		placePakete(seconds());
		draw();
		if (animated) frame = requestAnimationFrame(loop);
	}

	let previous: Parameters<FarbLabor['update']> | undefined;
	const api: FarbLabor = {
		update(ansicht, _tokens, alpha) {
			const tokens = resolveTokens(canvas.parentElement ?? document.documentElement, laborTokens());
			previous = [ansicht, tokens, alpha];
			const col = (token: string) => new THREE.Color(tokens[token] ?? tokens['--paper']);
			scene.background = col('--paper');
			const faerbungen: Faerbung[] = teile.map((t) => faerbe(t, ansicht));
			const durch = faerbungen.find((f) => f.oberflaeche !== 'matt')?.oberflaeche;
			clear.material = durch === 'glas' ? glas : milchig;
			const paper = col('--paper');
			faerbungen.forEach((f, i) => {
				const hinten = f.ebene === 'background';
				const opaque = !hinten && f.oberflaeche === 'matt';
				place(solid, i, opaque);
				place(clear, i, !hinten && !opaque);
				place(huelle, i, hinten);
				// Milky clouds toward paper (frosted glass); glass stays clear.
				const c = col(f.fill);
				if (f.oberflaeche === 'milchig') c.lerp(paper, 0.3);
				(hinten ? huelle : opaque ? solid : clear).setColorAt(i, c);
				kanten.setColor(i, col(f.kante));
			});
			const a = alpha[ansicht.oberflaeche === 'glas' ? '--alpha-hull' : '--alpha-glass'] ?? 0.6;
			milchig.opacity = glas.opacity = a;
			huellStoff.opacity = alpha['--alpha-hull'] ?? 0.3;
			glas.specular = col('--paper');
			for (const mesh of [solid, clear, huelle]) {
				mesh.instanceMatrix.needsUpdate = true;
				if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
			}
			kanten.commit();
			aktiv = new Set(aktiveWege(modell, ansicht).map((w) => w.id));
			// Packets glow in their flow: outbound in the base tone, return in the core (cycle).
			paketFarbe = liste.map((p) => col(paketToken(p.weg.strom, p.richtung)));
			placePakete(seconds());
			draw();
		},
		setLight(azimuth) {
			sun.position.set(Math.cos(azimuth) * 100, 120, Math.sin(azimuth) * 100);
			draw();
		},
		setAnimated(on) {
			animated = on;
			if (on && !frame) frame = requestAnimationFrame(loop);
			if (!on && frame) {
				cancelAnimationFrame(frame);
				frame = 0;
			}
		},
		resize(width, height) {
			if (!width || !height) return;
			renderer.setSize(width, height, false);
			const px = width / SICHT_M;
			const w = width / px / 2,
				h = height / px / 2;
			Object.assign(camera, { left: -w, right: w, top: h, bottom: -h });
			camera.updateProjectionMatrix();
			draw();
		},
		reset() {
			controls.target.copy(target);
			home();
			camera.updateProjectionMatrix();
			controls.update();
			draw();
		},
		info() {
			return {
				calls: renderer.info.render.calls,
				triangles: renderer.info.render.triangles,
				instances: n * 3 + liste.length
			};
		},
		dispose() {
			stopTheme();
			if (frame) cancelAnimationFrame(frame);
			controls.dispose();
			unit.dispose();
			kanten.dispose();
			paketMesh.geometry.dispose();
			for (const mat of [matte, milchig, glas, huellStoff, paketMesh.material])
				(mat as THREE.Material).dispose();
			renderer.dispose();
		}
	};
	const stopTheme = bindSceneTheme(canvas, scene, renderer, () => {
		if (previous) api.update(...previous);
	});
	return api;
}
