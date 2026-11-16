import * as THREE from 'three';
import { bindSceneTheme, resolveTokens } from '../themeBinding';
import type { Kiste, Vec3 } from '../../logic/stadt/kiste';
import type { Rahmen } from '../../logic/stadt/rahmen';
/**
 * Stage of the city building blocks: projects a list of boxes (logic/stadt/kiste.ts) with three.js.
 * Isometric parallel projection like the rest of the book, flat light in tone steps, ink edges.
 * The stage knows no time: it receives every image ready-made as a list (zeige). Colors exist only
 * as tokens and resolve in the current color mode; a mode change redraws.
 * Axes: model x → three x, model y → three −z, model z → three y (right-handed, viewed from the south).
 */

export type { Rahmen };

export type Buehne = {
	show(kisten: readonly Kiste[]): void;
	setRahmen(r: Rahmen): void;
	resize(widthPx: number, heightPx: number): void;
	/** Target under a point (CSS pixels relative to the canvas). */
	pick(xPx: number, yPx: number): string | undefined;
	/** Model point → CSS pixels relative to the canvas. */
	project(p: Vec3): { x: number; y: number };
	info(): { calls: number; triangles: number; kisten: number };
	dispose(): void;
};

const toThree = (p: Vec3) => new THREE.Vector3(p[0], p[2], -p[1]);

/** Twelve edges of a unit cube as segments. */
const EDGES = (() => {
	const out: number[] = [];
	for (const a of [0, 1])
		for (const b of [0, 1]) out.push(0, a, b, 1, a, b, a, 0, b, a, 1, b, a, b, 0, a, b, 1);
	return out;
})();

type Pool = {
	mesh: THREE.InstancedMesh;
	material: THREE.Material;
	targets: (string | undefined)[];
	count: number;
};

export function createBuehne(canvas: HTMLCanvasElement, start: Rahmen): Buehne {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);

	// Light as in the color lab: ambient plus one sun, top face ≈ 1 (tone steps, no gloss).
	const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.72 * Math.PI);
	const sun = new THREE.DirectionalLight(0xffffff, 0.32 * Math.PI);
	sun.position.set(-60, 140, 90);
	scene.add(hemi, sun);

	const unit = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, -0.5);
	const pools = new Map<string, Pool>();
	const host = canvas.parentElement ?? document.documentElement;

	// Edges: one dynamic LineSegments geometry that grows as needed.
	let edgeCap = 0;
	const edgeGeo = new THREE.BufferGeometry();
	const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true });
	const edges = new THREE.LineSegments(edgeGeo, edgeMat);
	edges.renderOrder = 5;
	edges.frustumCulled = false;
	scene.add(edges);
	function ensureEdges(n: number) {
		if (n <= edgeCap) return;
		edgeCap = Math.max(64, 2 ** Math.ceil(Math.log2(n)));
		const per = EDGES.length;
		edgeGeo.setAttribute(
			'position',
			new THREE.BufferAttribute(new Float32Array(edgeCap * per), 3).setUsage(THREE.DynamicDrawUsage)
		);
		edgeGeo.setAttribute(
			'color',
			new THREE.BufferAttribute(new Float32Array(edgeCap * per), 3).setUsage(THREE.DynamicDrawUsage)
		);
	}

	let colors = new Map<string, THREE.Color>();
	function color(token: string): THREE.Color {
		let c = colors.get(token);
		if (!c) {
			const hex = resolveTokens(host, [token])[token];
			c = new THREE.Color(hex);
			colors.set(token, c);
		}
		return c;
	}

	function pool(flat: boolean, alpha: number, need: number): Pool {
		const key = `${flat ? 'f' : 'l'}${alpha.toFixed(2)}`;
		let p = pools.get(key);
		if (p && p.mesh.instanceMatrix.count >= need) return p;
		const cap = Math.max(32, 2 ** Math.ceil(Math.log2(Math.max(need, 1))));
		const transparent = alpha < 1;
		const material =
			p?.material ??
			(flat
				? new THREE.MeshBasicMaterial({ transparent, opacity: alpha, depthWrite: !transparent })
				: new THREE.MeshLambertMaterial({ transparent, opacity: alpha, depthWrite: !transparent }));
		if (p) {
			scene.remove(p.mesh);
			p.mesh.dispose();
		}
		const mesh = new THREE.InstancedMesh(unit, material, cap);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		mesh.setColorAt(0, new THREE.Color());
		mesh.frustumCulled = false;
		mesh.renderOrder = transparent ? 2 : flat ? 1 : 0;
		scene.add(mesh);
		p = { mesh, material, targets: [], count: 0 };
		pools.set(key, p);
		return p;
	}

	let last: readonly Kiste[] = [];
	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const UP = new THREE.Vector3(0, 1, 0);

	function show(kisten: readonly Kiste[]) {
		last = kisten;
		// Count demand per pool, then fill.
		const need = new Map<string, number>();
		const keyOf = (k: Kiste) => `${k.flat ? 'f' : 'l'}${k.alpha.toFixed(2)}`;
		for (const k of kisten) need.set(keyOf(k), (need.get(keyOf(k)) ?? 0) + 1);
		for (const p of pools.values()) {
			p.count = 0;
			p.targets.length = 0;
		}
		const used = new Map<string, Pool>();
		for (const [key, n] of need) {
			const flat = key[0] === 'f';
			used.set(key, pool(flat, Number(key.slice(1)), n));
		}
		let edgeCount = 0;
		for (const k of kisten) if (k.edge) edgeCount++;
		ensureEdges(edgeCount);
		const pos = edgeGeo.getAttribute('position') as THREE.BufferAttribute | undefined;
		const col = edgeGeo.getAttribute('color') as THREE.BufferAttribute | undefined;
		const per = EDGES.length;
		let e = 0;
		for (const k of kisten) {
			const p = used.get(keyOf(k));
			if (!p) continue;
			const at = toThree(k.p);
			const yaw = k.yaw ?? 0;
			q.setFromAxisAngle(UP, yaw);
			m.compose(at, q, new THREE.Vector3(k.s[0], k.s[2], k.s[1]));
			p.mesh.setMatrixAt(p.count, m);
			p.mesh.setColorAt(p.count, color(k.fill));
			p.targets[p.count] = k.target;
			p.count++;
			if (k.edge && pos && col) {
				const c = color(k.edge);
				const base = e * per;
				const cos = Math.cos(yaw),
					sin = Math.sin(yaw);
				for (let v = 0; v < per; v += 3) {
					// Rotation about the vertical axis (three y), like the instance matrix.
					const x = EDGES[v] * k.s[0],
						z = -EDGES[v + 2] * k.s[1];
					pos.array[base + v] = at.x + x * cos + z * sin;
					pos.array[base + v + 1] = at.y + EDGES[v + 1] * k.s[2];
					pos.array[base + v + 2] = at.z - x * sin + z * cos;
					col.array[base + v] = c.r;
					col.array[base + v + 1] = c.g;
					col.array[base + v + 2] = c.b;
				}
				e++;
			}
		}
		for (const p of pools.values()) {
			p.mesh.count = p.count;
			p.mesh.instanceMatrix.needsUpdate = true;
			if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
		}
		if (pos && col) {
			pos.needsUpdate = col.needsUpdate = true;
			edgeGeo.setDrawRange(0, e * (per / 3));
		}
		renderer.render(scene, camera);
	}

	let rahmen = start;
	let size = { w: 1, h: 1 };
	function placeCamera() {
		const az = ((rahmen.azimuthDeg ?? 35) * Math.PI) / 180;
		const el = ((rahmen.elevationDeg ?? 30) * Math.PI) / 180;
		const target = toThree(rahmen.target);
		const d = 400;
		// View from the south (model −y = three +z), rotated by az toward the east.
		camera.position.set(
			target.x + d * Math.cos(el) * Math.sin(az),
			target.y + d * Math.sin(el),
			target.z + d * Math.cos(el) * Math.cos(az)
		);
		camera.up.set(0, 1, 0);
		camera.lookAt(target);
		const px = Math.min(size.w / rahmen.widthM, size.h / rahmen.heightM);
		const w = size.w / px / 2,
			h = size.h / px / 2;
		Object.assign(camera, { left: -w, right: w, top: h, bottom: -h });
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
	}
	placeCamera();

	const raycaster = new THREE.Raycaster();
	const api: Buehne = {
		show,
		setRahmen(r) {
			rahmen = r;
			placeCamera();
			show(last);
		},
		resize(widthPx, heightPx) {
			if (!widthPx || !heightPx) return;
			size = { w: widthPx, h: heightPx };
			renderer.setSize(widthPx, heightPx, false);
			placeCamera();
			show(last);
		},
		pick(xPx, yPx) {
			const ndc = new THREE.Vector2((xPx / size.w) * 2 - 1, -(yPx / size.h) * 2 + 1);
			raycaster.setFromCamera(ndc, camera);
			const meshes = [...pools.values()].filter((p) => p.count).map((p) => p.mesh);
			for (const hit of raycaster.intersectObjects(meshes, false)) {
				const p = [...pools.values()].find((x) => x.mesh === hit.object);
				const t = hit.instanceId !== undefined ? p?.targets[hit.instanceId] : undefined;
				if (t) return t;
			}
			return undefined;
		},
		project(p) {
			const v = toThree(p).project(camera);
			return { x: ((v.x + 1) / 2) * size.w, y: ((1 - v.y) / 2) * size.h };
		},
		info() {
			return {
				calls: renderer.info.render.calls,
				triangles: renderer.info.render.triangles,
				kisten: last.length
			};
		},
		dispose() {
			stopTheme();
			for (const p of pools.values()) {
				p.mesh.dispose();
				p.material.dispose();
			}
			unit.dispose();
			edgeGeo.dispose();
			edgeMat.dispose();
			renderer.dispose();
		}
	};
	const stopTheme = bindSceneTheme(canvas, scene, renderer, () => {
		colors = new Map();
		show(last);
	});
	return api;
}
