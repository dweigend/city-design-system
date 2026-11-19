import { srgbMix } from './material';
import {
	createDrawingRenderer,
	initializeDrawingRenderer,
	resizeDrawingRenderer
} from './drawing-renderer';
import { bindSceneTheme } from './themeBinding';
/**
 * Scene for L11 · World. Same pipeline as parametrik.ts: WebGPU renderer (WebGL 2
 * fallback), geometry from `build`, surface tone and outline from surfaces.ts, lines as
 * Line2. Unlike there, everything is gathered into a few geometries (batch.ts) so that a
 * whole district stays walkable. Existing stock optionally semi-transparent (43).
 * Three cameras: plan (2:1 dimetric), walk (eye level, with ground and horizon), walkthrough.
 */
import * as THREE from 'three/webgpu';
import { attribute, float, mix } from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Palette3D } from '../data/city3d';
import type { Primitive, Vec3 } from '../logic/parametrik/types';
import type { Point2 } from '../logic/parametrik/vocab';
import { contains } from '../logic/parametrik/formen/geom';
import { random } from '../logic/parametrik/random';
import { faceTone, outlinePosition } from './surfaces';
import { batch, geometryOf } from './batch';
import { sceneSwatch } from './scene-palette';

export type WeltMode = 'plan' | 'gehen' | 'rundgang';
export type WeltEbene = 'boden' | 'hochweg';
export type WeltInput = {
	primitives: Primitive[];
	tour: Vec3[];
	stand?: { von: Point2; nach: Point2 };
	blockers: Point2[][];
	extent: number;
};

/** New additions are lightened toward paper by this share (pastel). */
const PASTELL = 0.5;
const AUGE = 1.7;
const vector = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);

export function createWeltScene(
	canvas: HTMLCanvasElement,
	palette: Palette3D,
	onError: () => void
) {
	const renderer = createDrawingRenderer(canvas);
	const paper = new THREE.Color(palette.paper),
		ink = new THREE.Color(palette.ink),
		inkAlt = srgbMix(ink, paper, 0.62);
	const scene = new THREE.Scene();
	scene.background = paper;
	const fog = new THREE.Fog(paper, 1e5, 1e6);
	scene.fog = fog;
	const model = new THREE.Group(),
		/** Ground, horizon, and surroundings: only in walk mode. */
		umland = new THREE.Group(),
		papier = new THREE.Group();
	scene.add(model, umland, papier);
	const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 4000),
		persp = new THREE.PerspectiveCamera(68, 1, 0.2, 9000);
	const orbit = new OrbitControls(ortho, canvas);
	// Elevation stays at 30°: the dimetric of the plan drawing.
	orbit.minPolarAngle = orbit.maxPolarAngle = Math.PI / 3;
	orbit.screenSpacePanning = true;
	orbit.zoomSpeed = 0.8;
	orbit.zoomToCursor = true;
	let alive = true,
		initialized = false,
		width = 1,
		height = 1,
		mode: WeltMode = 'plan',
		ebene: WeltEbene = 'boden',
		glas = false,
		world: WeltInput = { primitives: [], tour: [], blockers: [], extent: 80 },
		tourT = 0,
		yaw = 0,
		pitch = 0,
		frame = 0;
	const pos = new THREE.Vector2(0, 0),
		keys = new Set<string>(),
		lineMaterials: THREE.Line2NodeMaterial[] = [];
	let frameMaterial: THREE.Line2NodeMaterial | undefined,
		bestand: { fill: THREE.Mesh; depth: THREE.Mesh } | undefined;

	const camera = () => (mode === 'plan' ? ortho : persp);
	// At most one image per animation frame, however many sliders are moving.
	let pending = 0;
	const render = () => {
		if (!alive || !initialized || pending) return;
		pending = requestAnimationFrame(() => {
			pending = 0;
			if (!alive) return;
			renderer.render(scene, camera());
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
		});
	};
	const ready = initializeDrawingRenderer(
		renderer,
		canvas,
		() => alive,
		() => {
			initialized = true;
			render();
		},
		onError
	);
	orbit.addEventListener('change', render);

	function clear(group: THREE.Group) {
		group.traverse((o) => {
			if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
				o.geometry.dispose();
				for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
			}
		});
		group.clear();
	}

	function colorOf(p: Primitive) {
		if (p.role === 'bestand') return srgbMix(paper, ink, (p.shade ?? 0.05) * 0.6);
		const base = new THREE.Color(sceneSwatch(palette, p.token));
		const c = p.token === '--paper' ? base : srgbMix(base, paper, PASTELL);
		return p.shade ? srgbMix(c, ink, p.shade) : c;
	}

	// Keep draw objects and materials across view changes; update their attributes in place.
	function faceGeometry(
		geometry: THREE.BufferGeometry,
		f: { p: number[]; n: number[]; c: number[] }
	) {
		const values = [
			['position', f.p],
			['normal', f.n],
			['color', f.c]
		] as const;
		if (
			values.some(
				([name, data]) => data.length && geometry.getAttribute(name)?.array.length !== data.length
			)
		) {
			geometry.dispose();
			return geometryOf(f);
		}
		for (const [name, data] of values) {
			if (!data.length) continue;
			const attribute = geometry.getAttribute(name);
			(attribute.array as Float32Array).set(data);
			attribute.needsUpdate = true;
		}
		geometry.computeBoundingSphere();
		return geometry;
	}

	function lines(
		target: THREE.Group,
		positions: number[],
		color: THREE.Color,
		px: number,
		colors?: number[],
		order = 0,
		key?: string
	) {
		const existing = key ? (target.getObjectByName(key) as LineSegments2 | undefined) : undefined;
		if (existing) {
			existing.visible = positions.length > 0;
			if (positions.length) {
				const attribute = existing.geometry.getAttribute(
					'instanceStart'
				) as THREE.InterleavedBufferAttribute;
				if (attribute.data.array.length !== positions.length) {
					existing.geometry.dispose();
					existing.geometry = new LineSegmentsGeometry().setPositions(positions);
				} else {
					attribute.data.array.set(positions);
					attribute.data.needsUpdate = true;
					existing.geometry.computeBoundingSphere();
				}
				if (colors) {
					const attribute = existing.geometry.getAttribute('instanceColorStart') as
						THREE.InterleavedBufferAttribute | undefined;
					if (attribute && attribute.data.array.length === colors.length) {
						attribute.data.array.set(colors);
						attribute.data.needsUpdate = true;
					} else existing.geometry.setColors(colors);
				}
			}
			if (!colors) existing.material.color.copy(color);
			return existing.material as THREE.Line2NodeMaterial;
		}
		if (!positions.length) return;
		const geometry = new LineSegmentsGeometry().setPositions(positions);
		if (colors) geometry.setColors(colors);
		const material = new THREE.Line2NodeMaterial({
			color: colors ? 0xffffff : color,
			linewidth: px,
			vertexColors: !!colors
		});
		material.userData.px = px;
		if (target === model) lineMaterials.push(material);
		const line = new LineSegments2(geometry, material);
		line.name = key ?? '';
		line.frustumCulled = false;
		line.renderOrder = order;
		target.add(line);
		return material;
	}

	/** Surface with a color per vertex and surface tone; `soft` softens the tone (white architectural model). */
	function surface(
		soft: number,
		more: ConstructorParameters<typeof THREE.MeshBasicNodeMaterial>[0] = {}
	) {
		const material = new THREE.MeshBasicNodeMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1,
			...more
		});
		material.colorNode = attribute('color', 'vec3').mul(mix(float(1), faceTone(), float(soft)));
		return material;
	}

	function rebuild() {
		const b = batch(world.primitives, colorOf);
		canvas.dataset.dreiecke = String(b.dreiecke);
		canvas.dataset.updates = String(Number(canvas.dataset.updates ?? 0) + 1);
		const add = (key: string, f: typeof b.neu, material: () => THREE.Material, order = 0) => {
			let mesh = model.getObjectByName(key) as THREE.Mesh | undefined;
			if (!mesh && f.p.length) {
				mesh = new THREE.Mesh(geometryOf(f), material());
				mesh.name = key;
				mesh.renderOrder = order;
				mesh.frustumCulled = false;
				model.add(mesh);
			} else if (mesh && f.p.length) mesh.geometry = faceGeometry(mesh.geometry, f);
			if (mesh) mesh.visible = f.p.length > 0;
			return mesh;
		};
		add('neu', b.neu, () => surface(1));
		add('blatt', b.blatt, () => surface(1, { side: THREE.DoubleSide }));
		for (const [key, f, color, px] of [
			['hull-alt', b.hull.alt, inkAlt, 0.9],
			['hull-neu', b.hull.neu, ink, 1.1]
		] as const)
			add(key, f, () => {
				const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, color });
				material.vertexNode = outlinePosition(px);
				return material;
			});
		frameMaterial = lines(model, b.staebe.p, ink, 2.6, b.staebe.c, 1, 'staebe');
		lines(model, b.kanten.neu, ink, 1.1, undefined, 1, 'kanten-neu');
		const depth = add('depth', b.alt, () => surface(0.55, { colorWrite: false }), 2),
			fill = add('bestand', b.alt, () => surface(0.55, { depthWrite: false }), 3);
		if (depth && fill) bestand = { depth, fill };
		lines(model, b.kanten.alt, inkAlt, 0.9, undefined, 4, 'kanten-alt');
		add(
			'glas',
			b.glas,
			() =>
				surface(0, {
					transparent: true,
					opacity: 0.3,
					depthWrite: false,
					side: THREE.DoubleSide
				}),
			5
		);
		durchsicht();
	}

	function durchsicht() {
		if (!bestand) return;
		const fill = bestand.fill.material as THREE.MeshBasicNodeMaterial,
			depth = bestand.depth.material as THREE.MeshBasicNodeMaterial;
		bestand.depth.visible = glas;
		fill.transparent = glas;
		fill.opacity = glas ? 0.42 : 1;
		fill.depthWrite = !glas;
		fill.needsUpdate = depth.needsUpdate = true;
	}

	/** Graph paper (plan) plus ground, horizon, and surroundings (walk). */
	function ground() {
		clear(papier);
		clear(umland);
		const r = Math.ceil((world.extent * 2.2) / 50) * 50;
		for (const [step, strength] of [
			[10, 0.07],
			[50, 0.14]
		]) {
			const pts: number[] = [];
			for (let t = -r; t <= r; t += step) {
				if (step === 10 && t % 50 === 0) continue;
				pts.push(t, -0.03, -r, t, -0.03, r, -r, -0.03, t, r, -0.03, t);
			}
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
			papier.add(
				new THREE.LineSegments(
					geometry,
					new THREE.LineBasicNodeMaterial({ color: srgbMix(paper, ink, strength) })
				)
			);
		}
		// Ground as a surface out to the horizon; the haze dissolves it into paper.
		const boden = new THREE.Mesh(
			new THREE.CircleGeometry(6000, 96).rotateX(-Math.PI / 2).translate(0, -0.08, 0),
			new THREE.MeshBasicNodeMaterial({ color: srgbMix(paper, ink, 0.075) })
		);
		umland.add(boden);
		// Horizon line: stays as a hairline, even in the haze.
		const kreis: number[] = [];
		for (let k = 0; k < 256; k++) {
			const a0 = (k / 256) * Math.PI * 2,
				a1 = ((k + 1) / 256) * Math.PI * 2;
			kreis.push(
				Math.cos(a0) * 5600,
				0,
				Math.sin(a0) * 5600,
				Math.cos(a1) * 5600,
				0,
				Math.sin(a1) * 5600
			);
		}
		const horizont = lines(umland, kreis, inkAlt, 0.9);
		if (horizont) horizont.fog = false;
		// Surroundings: the city continues as a white architectural model, without interventions.
		const rng = random(Math.round(world.extent * 977)),
			haeuser: Primitive[] = [];
		for (let k = 0; k < 150; k++) {
			const a = rng() * Math.PI * 2,
				d = world.extent * (1.45 + rng() * rng() * 4.2),
				w = 10 + rng() * 22,
				l = 10 + rng() * 26,
				h = 8 + rng() * rng() * 26;
			haeuser.push({
				id: `umland-${k}`,
				kind: 'box',
				position: [Math.cos(a) * d - w / 2, Math.sin(a) * d - l / 2, 0],
				size: [w, l, h],
				rotation: rng() * 0.6,
				role: 'bestand',
				token: '--paper',
				material: 'concrete',
				shade: 0.03
			});
		}
		const b = batch(haeuser, colorOf);
		umland.add(new THREE.Mesh(geometryOf(b.alt), surface(0.55)));
		lines(umland, b.kanten.alt, inkAlt, 0.9);
	}

	/** Point and view direction on the walkthrough (t from 0 to 1). */
	function tourAt(t: number) {
		const pts = world.tour.map(vector);
		if (pts.length < 2)
			return { at: new THREE.Vector3(0, AUGE, 0), dir: new THREE.Vector3(0, 0, -1) };
		const lens = pts.slice(1).map((q, i) => q.distanceTo(pts[i])),
			total = lens.reduce((a, b) => a + b, 0);
		const sample = (s: number) => {
			let rest = Math.max(0, Math.min(total, s));
			for (let i = 0; i < lens.length; i++) {
				if (rest <= lens[i] || i === lens.length - 1)
					return pts[i].clone().lerp(pts[i + 1], Math.min(1, rest / lens[i]));
				rest -= lens[i];
			}
			return pts[0].clone();
		};
		const s = Math.max(0, Math.min(1, t)) * total,
			at = sample(s),
			// Look a little ahead; at the end, back along the route.
			ahead = s + 12 <= total ? sample(s + 12) : at.clone().add(at.clone().sub(sample(s - 12)));
		return { at, dir: ahead.sub(at).setY(0).normalize() };
	}

	/** Eye level on the path network: height of the nearest point on the route (flights climb with it). */
	function wegHoehe() {
		let best = Infinity,
			y = AUGE;
		for (let i = 1; i < world.tour.length; i++) {
			const [ax, ay, az] = world.tour[i - 1],
				[bx, by, bz] = world.tour[i],
				dx = bx - ax,
				dy = by - ay,
				t = Math.max(
					0,
					Math.min(1, ((pos.x - ax) * dx + (pos.y - ay) * dy) / (dx * dx + dy * dy || 1))
				),
				d = Math.hypot(pos.x - ax - dx * t, pos.y - ay - dy * t);
			if (d < best) {
				best = d;
				y = az + (bz - az) * t;
			}
		}
		return y;
	}

	function place() {
		if (mode === 'plan') return render();
		if (mode === 'rundgang') {
			const { at, dir } = tourAt(tourT);
			persp.position.copy(at);
			const base = Math.atan2(-dir.x, -dir.z);
			persp.rotation.set(pitch - 0.05, base + yaw, 0, 'YXZ');
		} else {
			persp.position.set(pos.x, ebene === 'hochweg' ? wegHoehe() : AUGE, -pos.y);
			persp.rotation.set(pitch, yaw, 0, 'YXZ');
		}
		render();
	}

	function setMode(next: WeltMode) {
		mode = next;
		orbit.enabled = mode === 'plan';
		const walk = mode !== 'plan';
		umland.visible = walk;
		papier.visible = !walk;
		fog.near = walk ? 30 : 1e5;
		fog.far = walk ? Math.max(420, world.extent * 5.5) : 1e6;
		if (frameMaterial) {
			// In walk mode struts have a width in meters; in plan, in pixels.
			frameMaterial.worldUnits = walk;
			frameMaterial.needsUpdate = true;
		}
		strich();
		yaw = pitch = 0;
		if (mode === 'gehen') start();
		place();
	}

	/** Stroke width follows the image size: finer on a phone, or the drawing turns black. */
	function strich() {
		const k = Math.max(0.45, Math.min(1, Math.min(width / 900, height / 620)));
		for (const m of lineMaterials)
			m.linewidth = m === frameMaterial && mode !== 'plan' ? 0.16 : m.userData.px * k;
	}

	/** Start point of the walk: at the foot of the route (ground) or at the first landing above 6 m (elevated walkway). */
	function start() {
		const hoch = Math.max(
			1,
			world.tour.findIndex((q) => q[2] > 6 + AUGE)
		);
		const i = Math.min(hoch, world.tour.length - 2),
			a = ebene === 'hochweg' ? world.tour[i] : world.stand?.von,
			b = ebene === 'hochweg' ? world.tour[i + 1] : world.stand?.nach;
		if (!a || !b) return pos.set(0, 0);
		pos.set(a[0], a[1]);
		yaw = Math.atan2(-(b[0] - a[0]), b[1] - a[1]);
		pitch = 0;
	}

	function move(forward: number, side = 0) {
		if (mode !== 'gehen') return;
		const dx = -Math.sin(yaw) * forward + Math.cos(yaw) * side,
			dy = Math.cos(yaw) * forward + Math.sin(yaw) * side,
			next: Point2 = [pos.x + dx, pos.y + dy],
			limit = world.extent * 2.4;
		if (Math.hypot(next[0], next[1]) > limit) return;
		if (ebene === 'boden' && world.blockers.some((b) => contains(b, next))) return;
		pos.set(next[0], next[1]);
		place();
	}

	const loop = () => {
		frame = 0;
		if (!alive || !keys.size || mode !== 'gehen') return;
		const has = (...k: string[]) => k.some((key) => keys.has(key));
		if (has('ArrowLeft')) yaw += 0.035;
		if (has('ArrowRight')) yaw -= 0.035;
		move(
			(has('ArrowUp', 'w') ? 0.35 : 0) - (has('ArrowDown', 's') ? 0.35 : 0),
			(has('d') ? 0.3 : 0) - (has('a') ? 0.3 : 0)
		);
		place();
		frame = requestAnimationFrame(loop);
	};
	const walkKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
	const up3 = new THREE.Vector3(0, 1, 0);
	const onKeyDown = (e: KeyboardEvent) => {
		const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
		if (mode === 'plan') {
			if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
			const offset = ortho.position.clone().sub(orbit.target);
			offset.applyAxisAngle(up3, key === 'ArrowLeft' ? 0.1 : -0.1);
			ortho.position.copy(orbit.target).add(offset);
			orbit.update();
			e.preventDefault();
			return;
		}
		if (mode !== 'gehen' || !walkKeys.includes(key)) return;
		e.preventDefault();
		keys.add(key);
		if (!frame) frame = requestAnimationFrame(loop);
	};
	const onKeyUp = (e: KeyboardEvent) =>
		keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
	const onBlur = () => keys.clear();
	let drag: { x: number; y: number } | undefined;
	const onDown = (e: PointerEvent) => {
		if (mode === 'plan') return;
		drag = { x: e.clientX, y: e.clientY };
		canvas.setPointerCapture(e.pointerId);
	};
	const onMove = (e: PointerEvent) => {
		if (!drag || mode === 'plan') return;
		yaw += (e.clientX - drag.x) * 0.005;
		pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.004));
		drag = { x: e.clientX, y: e.clientY };
		place();
	};
	const onUp = () => (drag = undefined);
	canvas.addEventListener('keydown', onKeyDown);
	canvas.addEventListener('keyup', onKeyUp);
	canvas.addEventListener('blur', onBlur);
	canvas.addEventListener('pointerdown', onDown);
	canvas.addEventListener('pointermove', onMove);
	canvas.addEventListener('pointerup', onUp);
	canvas.addEventListener('pointercancel', onUp);

	function fitPlan() {
		const center = new THREE.Vector3(0, 9, 0);
		orbit.target.copy(center);
		ortho.position
			.copy(center)
			.add(new THREE.Vector3(-Math.sqrt(3 / 8), 0.5, Math.sqrt(3 / 8)).multiplyScalar(1200));
		ortho.zoom = 1;
		frustum();
		orbit.update();
	}
	function frustum() {
		const aspect = width / height,
			span = Math.max(world.extent * 0.8, (world.extent * 1.2) / aspect);
		ortho.left = -span * aspect;
		ortho.right = span * aspect;
		ortho.top = span;
		ortho.bottom = -span;
		ortho.updateProjectionMatrix();
		orbit.minZoom = 0.6;
		orbit.maxZoom = 14;
		persp.aspect = aspect;
		persp.updateProjectionMatrix();
	}

	const stopTheme = bindSceneTheme(canvas, scene, renderer, (next) => {
		palette = next;
		paper.set(next.paper);
		ink.set(next.ink);
		inkAlt.copy(srgbMix(ink, paper, 0.62));
		fog.color.copy(paper);
		for (const [name, color] of [
			['hull-alt', inkAlt],
			['hull-neu', ink]
		] as const) {
			const mesh = model.getObjectByName(name) as
				THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial> | undefined;
			mesh?.material.color.copy(color);
		}
		rebuild();
		ground();
		papier.visible = mode === 'plan';
		umland.visible = mode !== 'plan';
		render();
	});
	return {
		ready,
		update(next: WeltInput) {
			const resized = next.extent !== world.extent;
			const changed = next.primitives !== world.primitives;
			world = next;
			if (changed) rebuild();
			if (resized || !umland.children.length) {
				ground();
				fitPlan();
			}
			setMode(mode);
		},
		setMode,
		/** Existing stock semi-transparent (43) or as an opaque white architectural model. */
		setGlas(next: boolean) {
			glas = next;
			durchsicht();
			render();
		},
		/** Walkthrough: position from 0 to 1 along the route. */
		setTour(t: number) {
			tourT = t;
			if (mode === 'rundgang') place();
		},
		setEbene(next: WeltEbene) {
			ebene = next;
			if (mode === 'gehen') {
				start();
				place();
			}
		},
		/** One step in meters (for buttons and touch). */
		step(forward: number, turn = 0) {
			yaw += turn;
			move(forward);
			place();
		},
		reset() {
			fitPlan();
			setMode(mode);
		},
		resize(w: number, h: number) {
			[width, height] = resizeDrawingRenderer(renderer, w, h);
			strich();
			frustum();
			place();
		},
		dispose() {
			if (!alive) return;
			stopTheme();
			alive = false;
			cancelAnimationFrame(frame);
			cancelAnimationFrame(pending);
			canvas.removeEventListener('keydown', onKeyDown);
			canvas.removeEventListener('keyup', onKeyUp);
			canvas.removeEventListener('blur', onBlur);
			canvas.removeEventListener('pointerdown', onDown);
			canvas.removeEventListener('pointermove', onMove);
			canvas.removeEventListener('pointerup', onUp);
			canvas.removeEventListener('pointercancel', onUp);
			orbit.dispose();
			clear(model);
			clear(umland);
			clear(papier);
			if (initialized) renderer.dispose();
		}
	};
}
