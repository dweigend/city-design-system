import { compileSurface } from './material-library';
import * as THREE from 'three/webgpu';
import { bindSceneTheme } from './themeBinding';
import { kantenfarbe } from './materialRezept';
import type { Palette3D } from '../data/city3d';
import { BLICK, type MaterialModell } from '../logic/traeger/integration/material';
import type { Vec3 } from '../logic/traeger';

/**
 * Projection of a structural system with the recipes of the material page (WebGPU, WebGL 2 fallback).
 * Struts and hubs are one `InstancedMesh` per component, surfaces one geometry per recipe.
 * Parallel projection without light; tone, gloss, and turbidity come from the recipe (TSL).
 * Closeness (0 = whole structure, 1 = at the node) moves only the camera.
 * World → three.js: (x, y, z) → (x, z, −y). Draws only on change.
 */
export type TraegerMaterialSzene = {
	ready: Promise<void>;
	zeige(modell: MaterialModell): void;
	blick(naehe: number): void;
	resize(widthPx: number, heightPx: number): void;
	dispose(): void;
};

const welt = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);
/** Image height of the close-up in meters: one node with its struts. */
const NAH_HOEHE_M = 8;
const RAND = 1.16;

export function createTraegerMaterialSzene(
	canvas: HTMLCanvasElement,
	onError: () => void
): TraegerMaterialSzene {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const scene = new THREE.Scene(),
		gruppe = new THREE.Group();
	scene.add(gruppe);
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
	const richtung = new THREE.Vector3(
		Math.cos(BLICK.hoeheRad) * Math.sin(BLICK.azimutRad),
		Math.sin(BLICK.hoeheRad),
		Math.cos(BLICK.hoeheRad) * Math.cos(BLICK.azimutRad)
	);

	let alive = true,
		initialized = false,
		pending = 0,
		width = 1,
		height = 1,
		naehe = 0,
		palette: Palette3D | undefined,
		modell: MaterialModell | undefined,
		/** Geometry key: with the same parts list, only the materials change. */
		gebaut = '';
	const flaechenMeshes = new Map<string, THREE.Mesh>();
	const stabMeshes = new Map<string, THREE.InstancedMesh>();
	let nabenMesh: THREE.InstancedMesh | undefined;
	let linien: THREE.LineSegments | undefined;
	const figurTeile: THREE.Mesh[] = [];

	function render() {
		if (!alive || !initialized || pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			if (!alive) return;
			renderer.render(scene, camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
			canvas.dataset.drawCalls = String(renderer.info.render.drawCalls);
			canvas.dataset.triangles = String(renderer.info.render.triangles);
		});
	}

	function kamera() {
		if (!modell) return;
		const { min, max } = modell.grenzen;
		const mitte = welt([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]);
		camera.position.copy(mitte).addScaledVector(richtung, 100);
		camera.lookAt(mitte);
		camera.updateMatrixWorld();
		// Extent of the whole structure in screen space.
		const inv = camera.matrixWorldInverse,
			m = mitte.clone().applyMatrix4(inv);
		let bx = 0,
			by = 0;
		for (const x of [min[0], max[0]])
			for (const y of [min[1], max[1]])
				for (const z of [min[2], max[2]]) {
					const p = welt([x, y, z]).applyMatrix4(inv);
					bx = Math.max(bx, Math.abs(p.x - m.x));
					by = Math.max(by, Math.abs(p.y - m.y));
				}
		const a = width / height;
		const ganz = Math.max(by, bx / a) * RAND,
			nah = Math.min(ganz, NAH_HOEHE_M / 2);
		// Blend zoom geometrically: an even move across all scales.
		const halb = ganz * Math.pow(nah / ganz, naehe);
		const ziel = mitte.clone().lerp(welt(modell.nah), naehe);
		camera.position.copy(ziel).addScaledVector(richtung, 100);
		camera.lookAt(ziel);
		camera.top = halb;
		camera.bottom = -halb;
		camera.left = -halb * a;
		camera.right = halb * a;
		camera.updateProjectionMatrix();
	}

	function leere() {
		gruppe.traverse((o) => {
			if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
				o.geometry.dispose();
				(o.material as THREE.Material).dispose();
				if (o instanceof THREE.InstancedMesh) o.dispose();
			}
		});
		gruppe.clear();
		flaechenMeshes.clear();
		stabMeshes.clear();
		figurTeile.length = 0;
		nabenMesh = undefined;
		linien = undefined;
		gebaut = '';
	}

	/** Geometry once per parts list; materials are applied in `faerbe`. */
	function baue(m: MaterialModell) {
		leere();
		const leer = new THREE.MeshBasicNodeMaterial();
		for (const g of m.flaechen) {
			const pos: number[] = [];
			for (const ring of g.ringe) {
				const pts = ring.map(welt);
				for (let i = 1; i + 1 < pts.length; i++)
					for (const v of [pts[0], pts[i], pts[i + 1]]) pos.push(v.x, v.y, v.z);
			}
			const geo = new THREE.BufferGeometry();
			geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
			geo.computeVertexNormals();
			const mesh = new THREE.Mesh(geo, leer.clone());
			flaechenMeshes.set(g.id, mesh);
			gruppe.add(mesh);
		}
		const oben = new THREE.Vector3(0, 1, 0),
			obj = new THREE.Object3D();
		for (const g of m.staebe) {
			const mesh = new THREE.InstancedMesh(
				new THREE.CylinderGeometry(g.radiusM, g.radiusM, 1, 14, 1, true),
				leer.clone(),
				g.strecken.length
			);
			g.strecken.forEach(([p, q], i) => {
				const a = welt(p),
					d = welt(q).sub(a),
					laenge = d.length();
				obj.position.copy(a).addScaledVector(d, 0.5);
				obj.quaternion.setFromUnitVectors(oben, laenge > 0 ? d.divideScalar(laenge) : oben);
				obj.scale.set(1, laenge, 1);
				obj.updateMatrix();
				mesh.setMatrixAt(i, obj.matrix);
			});
			mesh.instanceMatrix.needsUpdate = true;
			mesh.frustumCulled = false;
			mesh.renderOrder = 2;
			stabMeshes.set(g.id, mesh);
			gruppe.add(mesh);
		}
		if (m.naben) {
			nabenMesh = new THREE.InstancedMesh(
				new THREE.SphereGeometry(m.naben.radiusM, 20, 12),
				leer.clone(),
				m.naben.punkte.length
			);
			obj.quaternion.identity();
			obj.scale.setScalar(1);
			m.naben.punkte.forEach((p, i) => {
				obj.position.copy(welt(p));
				obj.updateMatrix();
				nabenMesh?.setMatrixAt(i, obj.matrix);
			});
			nabenMesh.instanceMatrix.needsUpdate = true;
			nabenMesh.frustumCulled = false;
			nabenMesh.renderOrder = 2;
			gruppe.add(nabenMesh);
		}
		if (m.linien.length) {
			const geo = new THREE.BufferGeometry().setFromPoints(
				m.linien.flatMap(([a, b]) => [welt(a), welt(b)])
			);
			linien = new THREE.LineSegments(
				geo,
				new THREE.LineDashedMaterial({
					dashSize: 0.18,
					gapSize: 0.14,
					transparent: true,
					opacity: 0.6
				})
			);
			linien.computeLineDistances();
			linien.renderOrder = 4;
			gruppe.add(linien);
		}
		// Figur von 1,8 m in Tinte.
		const figur = new THREE.Group();
		figur.position.copy(welt(m.figur));
		const koerper = new THREE.Mesh(
			new THREE.CylinderGeometry(0.11, 0.14, 1.42, 10),
			new THREE.MeshBasicMaterial()
		);
		koerper.position.y = 0.71;
		const kopf = new THREE.Mesh(
			new THREE.SphereGeometry(0.19, 12, 8),
			new THREE.MeshBasicMaterial()
		);
		kopf.position.y = 1.61;
		figur.add(koerper, kopf);
		figurTeile.push(koerper, kopf);
		gruppe.add(figur);
		leer.dispose();
	}

	function setze(mesh: THREE.Mesh, material: THREE.Material, transparent: boolean) {
		(mesh.material as THREE.Material).dispose();
		mesh.material = material;
		if (!(mesh instanceof THREE.InstancedMesh)) mesh.renderOrder = transparent ? 3 : 1;
	}

	function faerbe(m: MaterialModell, p: Palette3D) {
		for (const g of m.flaechen) {
			const mesh = flaechenMeshes.get(g.id);
			if (mesh)
				setze(
					mesh,
					compileSurface({ kind: 'diagram', recipe: g.rezept }, p),
					g.rezept.haut.deckkraft < 1
				);
		}
		for (const g of m.staebe) {
			const mesh = stabMeshes.get(g.id);
			if (mesh)
				setze(
					mesh,
					compileSurface({ kind: 'diagram', recipe: g.rezept }, p, { double: false }),
					false
				);
		}
		if (nabenMesh && m.naben)
			setze(
				nabenMesh,
				compileSurface({ kind: 'diagram', recipe: m.naben.rezept }, p, { double: false }),
				false
			);
		const tinte = m.flaechen[0] ? kantenfarbe(m.flaechen[0].rezept, p) : new THREE.Color(p.ink);
		if (linien) (linien.material as THREE.LineDashedMaterial).color.copy(tinte);
		for (const teil of figurTeile) (teil.material as THREE.MeshBasicMaterial).color.set(p.ink);
	}

	function zeichne() {
		if (!modell || !palette) return;
		const key = JSON.stringify([
			modell.familie,
			modell.flaechen.map((g) => [g.id, g.ringe]),
			modell.staebe.map((g) => [g.id, g.radiusM, g.strecken]),
			modell.naben?.punkte,
			modell.linien,
			modell.figur
		]);
		if (key !== gebaut) {
			baue(modell);
			gebaut = key;
		}
		faerbe(modell, palette);
		kamera();
		render();
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
			if (alive) onError();
			throw cause;
		});

	const stopTheme = bindSceneTheme(canvas, scene, renderer, (p) => {
		palette = p;
		zeichne();
	});

	return {
		ready,
		zeige(m) {
			modell = m;
			zeichne();
		},
		blick(n) {
			naehe = Math.max(0, Math.min(1, n));
			kamera();
			render();
		},
		resize(w, h) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			renderer.setSize(width, height, false);
			kamera();
			render();
		},
		dispose() {
			alive = false;
			if (pending) cancelAnimationFrame(pending);
			stopTheme();
			leere();
			if (initialized) renderer.dispose();
		}
	};
}
