import * as THREE from 'three/webgpu';
import { attribute, mix, float } from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { bindSceneTheme, resolveTokens } from './themeBinding';
import { batch, geometryOf } from './batch';
import { sceneSwatch } from './scene-palette';
import { faceTone, outlinePosition } from './surfaces';
import type { Palette3D } from '../data/city3d';
import type { Primitive } from '../logic/parametrik/types';
import type { Point2 } from '../logic/parametrik/vocab';
/**
 * Stage of the grid chapter: projects lines, surfaces, points, and optionally the city (primitives
 * from `welt`) with three.js. WebGPU, WebGL 2 fallback. Parallel projection like the rest of the book:
 * top view (90°) for the mesh, oblique view for volumes; the switch glides, except under
 * reduced motion. Colors exist only as tokens and follow the page mode.
 * Axes: model x → three x, model y → three −z, model z → three y.
 */

export type Linien = {
	key: string;
	/** Segments as x0, y0, x1, y1, … in meters. */
	strecken: number[];
	token: string;
	/** Stroke width in CSS pixels. */
	px: number;
	/** Paper share (0 = full color). */
	papier?: number;
	z?: number;
};
export type Flaeche = {
	polygon: Point2[];
	token: string;
	papier?: number;
	z?: number;
	/** Prism height in meters; without a height, a flat surface. */
	hoehe?: number;
	/** Roof of a prism, corner by corner matching `polygon` (offset); vertical if omitted. */
	oben?: Point2[];
	/** Holes in a flat surface (ring, band). */
	loecher?: Point2[][];
};
export type Kreis = { p: Point2; token: string; px: number; papier?: number; z?: number };
export type Bild = {
	linien: Linien[];
	flaechen?: Flaeche[];
	kreise?: Kreis[];
	/** City from `welt`; null hides it. */
	stadt?: Primitive[] | null;
};
export type Blick = {
	/** Halbe sichtbare Breite in Metern. */
	extent: number;
	/** Elevation above the horizon in degrees (90 = top view). */
	hoeheDeg: number;
	azimutDeg?: number;
};

export type RasterBuehne = {
	ready: Promise<void>;
	zeige(bild: Bild): void;
	setBlick(blick: Blick, gleiten?: boolean): void;
	resize(widthPx: number, heightPx: number): void;
	/** Image point (CSS pixels relative to the canvas) → model point on the ground. */
	zumBoden(xPx: number, yPx: number): Point2;
	/** Model point on the ground → CSS pixels relative to the canvas. */
	projiziere(p: Point2, z?: number): { x: number; y: number };
	/** Return the camera to the last view. */
	zuruecksetzen(): void;
	dispose(): void;
};

const PASTELL = 0.5;
const v3 = (x: number, y: number, z = 0) => new THREE.Vector3(x, z, -y);
const srgbMix = (a: THREE.Color, b: THREE.Color, t: number) =>
	a.clone().convertLinearToSRGB().lerp(b.clone().convertLinearToSRGB(), t).convertSRGBToLinear();
const sanft = (x: number) => x * x * (3 - 2 * x);

export function createRasterBuehne(
	canvas: HTMLCanvasElement,
	start: Blick,
	optionen: { drehen?: boolean; onError?: () => void } = {}
): RasterBuehne {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
	const host = canvas.parentElement ?? document.documentElement;
	const ruhe =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	const netz = new THREE.Group(),
		flaechen = new THREE.Group(),
		stadt = new THREE.Group(),
		punkte = new THREE.Group();
	scene.add(flaechen, stadt, netz, punkte);

	let alive = true,
		initialized = false,
		width = 1,
		height = 1,
		pending = 0,
		blick: Blick = { azimutDeg: 0, ...start },
		hoehe = start.hoeheDeg,
		gleit: { von: number; nach: number; t0: number } | undefined,
		letztes: Bild = { linien: [] },
		stadtQuelle: Primitive[] | null | undefined,
		farben: Record<string, THREE.Color> = {},
		palette: Palette3D | undefined;

	const controls = new OrbitControls(camera, canvas);
	controls.enableRotate = !!optionen.drehen;
	controls.enablePan = !!optionen.drehen;
	controls.enableZoom = !!optionen.drehen;
	controls.screenSpacePanning = true;
	controls.zoomToCursor = true;
	controls.zoomSpeed = 0.8;
	controls.minZoom = 0.6;
	controls.maxZoom = 6;
	// OrbitControls block touch gestures (inline touch-action: none). Without rotation, the canvas
	// CSS applies again so the page scrolls over the image on a phone.
	if (!optionen.drehen) canvas.style.touchAction = '';

	const render = () => {
		if (!alive || !initialized || pending) return;
		pending = requestAnimationFrame((now) => {
			pending = 0;
			if (!alive) return;
			if (gleit) {
				const t = Math.min(1, (now - gleit.t0) / 520);
				hoehe = gleit.von + (gleit.nach - gleit.von) * sanft(t);
				kamera(false);
				if (t >= 1) gleit = undefined;
				else render();
			}
			renderer.render(scene, camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
		});
	};
	controls.addEventListener('change', () => {
		kreise(letztes.kreise ?? []);
		render();
	});

	/** Camera from view and current elevation; `ganz` also resets zoom and target. */
	function kamera(ganz: boolean) {
		const polar = THREE.MathUtils.degToRad(90 - Math.min(89.5, hoehe));
		controls.minPolarAngle = controls.maxPolarAngle = polar;
		if (ganz) {
			camera.zoom = 1;
			controls.target.set(0, 0, 0);
			const az = THREE.MathUtils.degToRad(blick.azimutDeg ?? 0);
			camera.position.set(
				Math.sin(polar) * Math.sin(az) * 1000,
				Math.cos(polar) * 1000,
				Math.sin(polar) * Math.cos(az) * 1000
			);
		} else {
			const off = camera.position.clone().sub(controls.target);
			const sph = new THREE.Spherical().setFromVector3(off);
			sph.phi = polar;
			sph.radius = 1000;
			camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
		}
		camera.lookAt(controls.target);
		const k = blick.extent * 1.04,
			a = width / height;
		// The tighter dimension fits the district.
		const halbH = a >= 1 ? k : k / a,
			halbB = halbH * a;
		camera.left = -halbB;
		camera.right = halbB;
		camera.top = halbH;
		camera.bottom = -halbH;
		camera.updateProjectionMatrix();
		controls.update();
	}

	function farbe(token: string, papier = 0) {
		const base = farben[token] ?? farben['--ink'] ?? new THREE.Color(0x333333);
		return papier ? srgbMix(base, farben['--paper'] ?? base, papier) : base;
	}

	function leere(group: THREE.Group, key?: string) {
		for (const o of [...group.children]) {
			if (key && o.name !== key) continue;
			o.traverse((x) => {
				if (x instanceof THREE.Mesh || x instanceof THREE.LineSegments) {
					x.geometry.dispose();
					for (const m of Array.isArray(x.material) ? x.material : [x.material]) m.dispose();
				}
			});
			group.remove(o);
		}
	}

	function linien(l: Linien) {
		const pos: number[] = [];
		const z = l.z ?? 0.08;
		for (let k = 0; k + 3 < l.strecken.length; k += 4) {
			const a = v3(l.strecken[k], l.strecken[k + 1], z),
				b = v3(l.strecken[k + 2], l.strecken[k + 3], z);
			pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
		}
		let line = netz.getObjectByName(l.key) as LineSegments2 | undefined;
		if (!pos.length) {
			if (line) line.visible = false;
			return;
		}
		if (line) {
			const attr = line.geometry.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute;
			if (attr.data.array.length === pos.length) {
				attr.data.array.set(pos);
				attr.data.needsUpdate = true;
				line.geometry.computeBoundingSphere();
			} else {
				line.geometry.dispose();
				line.geometry = new LineSegmentsGeometry().setPositions(pos);
			}
			const m = line.material as THREE.Line2NodeMaterial;
			m.color.copy(farbe(l.token, l.papier));
			m.linewidth = l.px;
			line.visible = true;
			return;
		}
		const material = new THREE.Line2NodeMaterial({
			color: farbe(l.token, l.papier),
			linewidth: l.px
		});
		line = new LineSegments2(new LineSegmentsGeometry().setPositions(pos), material);
		line.name = l.key;
		line.frustumCulled = false;
		line.renderOrder = 2;
		netz.add(line);
	}

	function flaechenmaterial() {
		const m = new THREE.MeshBasicNodeMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1,
			side: THREE.DoubleSide
		});
		m.colorNode = attribute('color', 'vec3').mul(faceTone());
		return m;
	}

	function zeichneFlaechen(liste: Flaeche[]) {
		leere(flaechen);
		if (!liste.length) return;
		const p: number[] = [],
			n: number[] = [],
			c: number[] = [];
		const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, col: THREE.Color) => {
			const nn = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
			nn.normalize();
			for (const q of [a, b, d]) {
				p.push(q.x, q.y, q.z);
				n.push(nn.x, nn.y, nn.z);
				c.push(col.r, col.g, col.b);
			}
		};
		for (const f of liste) {
			const col = farbe(f.token, f.papier),
				z0 = f.z ?? 0,
				z1 = z0 + (f.hoehe ?? 0),
				dach = f.hoehe && f.oben?.length === f.polygon.length ? f.oben : f.polygon,
				loecher = f.hoehe ? [] : (f.loecher ?? []);
			const alle = [dach, ...loecher];
			const faces = THREE.ShapeUtils.triangulateShape(
				dach.map(([x, y]) => new THREE.Vector2(x, y)),
				loecher.map((l) => l.map(([x, y]) => new THREE.Vector2(x, y)))
			);
			const ecke = alle.flat();
			for (const [i, j, k] of faces) {
				const [a, b, d] = [i, j, k].map((q) => v3(ecke[q][0], ecke[q][1], z1));
				// Top face points up (three y).
				const nn = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
				if (nn.y >= 0) tri(a, b, d, col);
				else tri(a, d, b, col);
			}
			if (f.hoehe)
				f.polygon.forEach((q, i) => {
					const j = (i + 1) % f.polygon.length,
						r = f.polygon[j];
					const a = v3(q[0], q[1], z0),
						b = v3(r[0], r[1], z0),
						a1 = v3(dach[i][0], dach[i][1], z1),
						b1 = v3(dach[j][0], dach[j][1], z1);
					tri(a, b, b1, col);
					tri(a, b1, a1, col);
				});
		}
		const mesh = new THREE.Mesh(geometryOf({ p, n, c }), flaechenmaterial());
		mesh.frustumCulled = false;
		flaechen.add(mesh);
	}

	/** Points as discs in meters, sized from pixels: rebuilt after zoom and resize. */
	function kreise(liste: Kreis[]) {
		leere(punkte);
		if (!liste.length) return;
		const mProPx = (camera.top - camera.bottom) / camera.zoom / Math.max(1, height);
		const p: number[] = [],
			n: number[] = [],
			c: number[] = [];
		const SEG = 14;
		for (const k of liste) {
			const r = (k.px / 2) * mProPx,
				col = farbe(k.token, k.papier),
				m = v3(k.p[0], k.p[1], k.z ?? 0.1);
			for (let s = 0; s < SEG; s++) {
				const a0 = (s / SEG) * Math.PI * 2,
					a1 = ((s + 1) / SEG) * Math.PI * 2;
				for (const q of [
					m,
					v3(k.p[0] + r * Math.cos(a1), k.p[1] + r * Math.sin(a1), k.z ?? 0.1),
					v3(k.p[0] + r * Math.cos(a0), k.p[1] + r * Math.sin(a0), k.z ?? 0.1)
				]) {
					p.push(q.x, q.y, q.z);
					n.push(0, 1, 0);
					c.push(col.r, col.g, col.b);
				}
			}
		}
		const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
		material.colorNode = attribute('color', 'vec3');
		const mesh = new THREE.Mesh(geometryOf({ p, n, c }), material);
		mesh.renderOrder = 6;
		mesh.frustumCulled = false;
		punkte.add(mesh);
	}

	function stadtFarbe(q: Primitive) {
		const paper = farbe('--paper'),
			ink = farbe('--ink');
		if (q.role === 'bestand') return srgbMix(paper, ink, (q.shade ?? 0.05) * 0.6);
		const base = palette ? new THREE.Color(sceneSwatch(palette, q.token)) : paper;
		const c = q.token === '--paper' ? base : srgbMix(base, paper, PASTELL);
		return q.shade ? srgbMix(c, ink, q.shade) : c;
	}

	function zeichneStadt(liste: Primitive[] | null | undefined) {
		leere(stadt);
		if (!liste?.length) return;
		const b = batch(liste, stadtFarbe);
		const ink = farbe('--ink'),
			inkAlt = srgbMix(ink, farbe('--paper'), 0.62);
		const flaeche = (f: typeof b.neu, soft: number) => {
			if (!f.p.length) return;
			const m = new THREE.MeshBasicNodeMaterial({
				polygonOffset: true,
				polygonOffsetFactor: 1,
				polygonOffsetUnits: 1
			});
			m.colorNode = attribute('color', 'vec3').mul(mix(float(1), faceTone(), float(soft)));
			const mesh = new THREE.Mesh(geometryOf(f), m);
			mesh.frustumCulled = false;
			stadt.add(mesh);
		};
		flaeche(b.neu, 1);
		flaeche(b.blatt, 1);
		flaeche(b.alt, 0.55);
		for (const [f, col, px] of [
			[b.hull.alt, inkAlt, 0.9],
			[b.hull.neu, ink, 1.1]
		] as const) {
			if (!f.p.length) continue;
			const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, color: col });
			m.vertexNode = outlinePosition(px);
			const mesh = new THREE.Mesh(geometryOf(f), m);
			mesh.frustumCulled = false;
			stadt.add(mesh);
		}
		for (const [pos, col, px, colors] of [
			[b.kanten.neu, ink, 1.1, undefined],
			[b.kanten.alt, inkAlt, 0.9, undefined],
			[b.staebe.p, ink, 2.2, b.staebe.c]
		] as const) {
			if (!pos.length) continue;
			const g = new LineSegmentsGeometry().setPositions(pos);
			if (colors) g.setColors(colors);
			const m = new THREE.Line2NodeMaterial({
				color: colors ? 0xffffff : col,
				linewidth: px,
				vertexColors: !!colors
			});
			const line = new LineSegments2(g, m);
			line.frustumCulled = false;
			stadt.add(line);
		}
	}

	function zeige(bild: Bild) {
		letztes = bild;
		const keys = new Set(bild.linien.map((l) => l.key));
		for (const o of netz.children) if (!keys.has(o.name)) o.visible = false;
		for (const l of bild.linien) linien(l);
		zeichneFlaechen(bild.flaechen ?? []);
		kreise(bild.kreise ?? []);
		if (bild.stadt !== stadtQuelle) {
			stadtQuelle = bild.stadt;
			zeichneStadt(bild.stadt);
		}
		render();
	}

	const tokens = () => {
		const namen = new Set(['--paper', '--ink']);
		for (const l of letztes.linien) namen.add(l.token);
		for (const f of letztes.flaechen ?? []) namen.add(f.token);
		for (const k of letztes.kreise ?? []) namen.add(k.token);
		namen.add('--blueprint');
		return [...namen];
	};

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

	kamera(true);
	const stopTheme = bindSceneTheme(canvas, scene, renderer, (p) => {
		palette = p;
		const hex = resolveTokens(host, [...tokens(), '--ink-2', '--ink-3', '--signal', '--line']);
		farben = Object.fromEntries(Object.entries(hex).map(([k, v]) => [k, new THREE.Color(v)]));
		// Redraw everything in the new colors.
		stadtQuelle = undefined;
		zeige(letztes);
	});

	return {
		ready,
		zeige(bild) {
			letztes = bild;
			// Resolve new tokens only when an image needs them.
			const fehlt = tokens().filter((t) => !farben[t]);
			if (fehlt.length)
				for (const [k, v] of Object.entries(resolveTokens(host, fehlt)))
					farben[k] = new THREE.Color(v);
			zeige(bild);
		},
		setBlick(b, gleiten = false) {
			const von = hoehe;
			blick = { azimutDeg: blick.azimutDeg, ...b };
			if (gleiten && !ruhe && initialized && Math.abs(von - b.hoeheDeg) > 0.5) {
				gleit = { von, nach: b.hoeheDeg, t0: performance.now() };
			} else {
				gleit = undefined;
				hoehe = b.hoeheDeg;
			}
			kamera(false);
			kreise(letztes.kreise ?? []);
			render();
		},
		resize(w, h) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			renderer.setSize(width, height, false);
			kamera(false);
			kreise(letztes.kreise ?? []);
			render();
		},
		zumBoden(x, y) {
			const ndc = new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1);
			const ray = new THREE.Raycaster();
			ray.setFromCamera(ndc, camera);
			const hit = new THREE.Vector3();
			ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit);
			return [hit.x, -hit.z];
		},
		projiziere(p, z = 0) {
			const v = v3(p[0], p[1], z).project(camera);
			return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
		},
		zuruecksetzen() {
			hoehe = blick.hoeheDeg;
			gleit = undefined;
			kamera(true);
			kreise(letztes.kreise ?? []);
			render();
		},
		dispose() {
			alive = false;
			if (pending) cancelAnimationFrame(pending);
			stopTheme();
			controls.dispose();
			for (const g of [netz, flaechen, stadt, punkte]) leere(g);
			if (initialized) renderer.dispose();
		}
	};
}
