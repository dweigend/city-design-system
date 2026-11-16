import { bindSceneTheme } from './themeBinding';
import * as THREE from 'three/webgpu';
import { attribute, mix, uniform, vec3 } from 'three/tsl';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Palette3D } from '../data/city3d';
import { MASS, uvw, type Kiste, type Rolle, type V3 } from '../logic/modellierung/cage';

/**
 * Cage view: geometry is built once and carries (u, v, w) per vertex.
 * A TSL position node evaluates the trilinear cage from eight uniforms.
 * Motion = eight uniform vectors, no geometry upload.
 * Logic x/y plan, z up → three (x, z, −y).
 */
export function createCageScene(
	canvas: HTMLCanvasElement,
	palette: Palette3D,
	onError: () => void
) {
	const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: false });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(palette.paper);
	const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
	const controls = new OrbitControls(camera, canvas);
	controls.enablePan = false;
	controls.minZoom = 0.5;
	controls.maxZoom = 4;
	controls.listenToKeyEvents(canvas);

	const punkte = Array.from({ length: 8 }, () => uniform(new THREE.Vector3()));
	const w = attribute('uvw', 'vec3');
	const ebene = (a: number, b: number) => mix(punkte[a], punkte[b], w.x);
	const p = mix(mix(ebene(0, 1), ebene(2, 3), w.y), mix(ebene(4, 5), ebene(6, 7), w.y), w.z);
	const lage = vec3(p.x, p.z, p.y.negate());

	const geometrien: THREE.BufferGeometry[] = [];
	const materialien: THREE.Material[] = [];
	const colorUpdates: (() => void)[] = [];
	const flaechenMaterial = (farbe: () => string) => {
		const m = new THREE.MeshBasicNodeMaterial({
			side: THREE.DoubleSide,
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		});
		m.positionNode = lage;
		const tint = uniform(new THREE.Color(farbe()));
		colorUpdates.push(() => tint.value.set(farbe()));
		m.colorNode = tint.mul(attribute('ton', 'float'));
		materialien.push(m);
		return m;
	};
	const linienMaterial = (farbe: () => string) => {
		const m = new THREE.LineBasicNodeMaterial({ color: new THREE.Color(farbe()) });
		m.positionNode = lage;
		colorUpdates.push(() => m.color.set(farbe()));
		materialien.push(m);
		return m;
	};

	// Box → 24 vertices (6 faces) with a tone per face direction; plus 12 edges.
	const toene = [0.86, 0.86, 0.94, 0.94, 1, 0.78];
	function kisten(liste: Kiste[]) {
		const pos: number[] = [],
			u: number[] = [],
			ton: number[] = [],
			index: number[] = [],
			kpos: number[] = [],
			ku: number[] = [];
		const ecke = (k: Kiste, i: number, j: number, l: number): V3 => [
			i ? k.max[0] : k.min[0],
			j ? k.max[1] : k.min[1],
			l ? k.max[2] : k.min[2]
		];
		const flaechen = [
			[1, 0, 0], // +x
			[-1, 0, 0],
			[0, 1, 0],
			[0, -1, 0],
			[0, 0, 1], // up
			[0, 0, -1]
		];
		for (const k of liste) {
			flaechen.forEach((n, f) => {
				const a = n.findIndex((x) => x !== 0),
					s = n[a] > 0 ? 1 : 0;
				const b = (a + 1) % 3,
					c = (a + 2) % 3;
				const basis = pos.length / 3;
				for (const [x, y] of [
					[0, 0],
					[1, 0],
					[1, 1],
					[0, 1]
				]) {
					const bit = [0, 0, 0];
					bit[a] = s;
					bit[b] = x;
					bit[c] = y;
					const q = ecke(k, bit[0], bit[1], bit[2]);
					pos.push(q[0], q[2], -q[1]);
					u.push(...uvw(q));
					ton.push(toene[f]);
				}
				index.push(basis, basis + 1, basis + 2, basis, basis + 2, basis + 3);
			});
			for (let n = 0; n < 12; n++) {
				const achse = n >> 2,
					m = n & 3;
				const bit0 = [0, 0, 0];
				bit0[(achse + 1) % 3] = m & 1;
				bit0[(achse + 2) % 3] = m >> 1;
				const bit1 = [...bit0];
				bit1[achse] = 1;
				for (const bit of [bit0, bit1]) {
					const q = ecke(k, bit[0], bit[1], bit[2]);
					kpos.push(q[0], q[2], -q[1]);
					ku.push(...uvw(q));
				}
			}
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
		g.setAttribute('uvw', new THREE.Float32BufferAttribute(u, 3));
		g.setAttribute('ton', new THREE.Float32BufferAttribute(ton, 1));
		g.setIndex(index);
		const l = new THREE.BufferGeometry();
		l.setAttribute('position', new THREE.Float32BufferAttribute(kpos, 3));
		l.setAttribute('uvw', new THREE.Float32BufferAttribute(ku, 3));
		geometrien.push(g, l);
		return { g, l };
	}

	const modell = new THREE.Group();
	scene.add(modell);
	const farben = (): Record<Rolle, { flaeche: string; linie: string }> => ({
		modul: { flaeche: palette.paper, linie: palette.ink },
		kern: {
			flaeche:
				'#' +
				new THREE.Color(palette.paper).lerp(new THREE.Color(palette.ink), 0.22).getHexString(),
			linie: palette.ink
		},
		treppe: { flaeche: palette.categories.business, linie: palette.categories.business }
	});
	let gebaut = false;
	function setze(liste: Kiste[]) {
		colorUpdates.length = 0;
		for (const o of [...modell.children]) modell.remove(o);
		for (const g of geometrien.splice(0)) g.dispose();
		for (const m of materialien.splice(0)) m.dispose();
		for (const rolle of ['kern', 'modul', 'treppe'] as Rolle[]) {
			const teil = liste.filter((k) => k.rolle === rolle);
			if (!teil.length) continue;
			const { g, l } = kisten(teil);
			modell.add(
				new THREE.Mesh(
					g,
					flaechenMaterial(() => farben()[rolle].flaeche)
				)
			);
			modell.add(
				new THREE.LineSegments(
					l,
					linienMaterial(() => farben()[rolle].linie)
				)
			);
		}
		// The deformed pose departs from the rest pose: disable culling by rest bounds.
		for (const o of modell.children) o.frustumCulled = false;
		// The cage itself: twelve edges in Signal.
		const cage = kisten([{ id: 'cage', rolle: 'modul', min: [0, 0, 0], max: MASS }]);
		const rahmen = new THREE.LineSegments(
			cage.l,
			linienMaterial(() => palette.categories['--signal'])
		);
		rahmen.frustumCulled = false;
		modell.add(rahmen);
		cage.g.dispose();
		gebaut = true;
		render();
	}

	let alive = true,
		initialized = false;
	const ready = renderer
		.init()
		.then(() => {
			initialized = true;
			if (!alive) {
				renderer.dispose();
				return;
			}
			canvas.dataset.backend =
				'isWebGPUBackend' in renderer.backend && renderer.backend.isWebGPUBackend
					? 'webgpu'
					: 'webgl2';
			render();
		})
		.catch((cause) => {
			if (alive) onError();
			throw cause;
		});
	function render() {
		if (!alive || !initialized || !gebaut) return;
		renderer.render(scene, camera);
		canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
	}
	controls.addEventListener('change', render);

	const mitte = new THREE.Vector3(MASS[0] / 2, MASS[2] / 2, -MASS[1] / 2);
	function ansicht() {
		const auge = new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(120);
		camera.position.copy(mitte).add(auge);
		camera.zoom = 1;
		controls.target.copy(mitte);
		camera.lookAt(mitte);
		controls.update();
	}
	ansicht();

	const stopTheme = bindSceneTheme(canvas, scene, renderer, (next) => {
		palette = next;
		for (const update of colorUpdates) update();
		render();
	});
	return {
		ready,
		setze,
		/** Eight control points in logic coordinates (x, y, z up). */
		verforme(c: V3[]) {
			c.forEach((q, i) => punkte[i].value.set(q[0], q[1], q[2]));
			render();
		},
		resize(width: number, height: number) {
			renderer.setSize(width, height, false);
			const halb = 22;
			const a = width / Math.max(1, height);
			camera.left = -halb * a;
			camera.right = halb * a;
			camera.top = halb;
			camera.bottom = -halb;
			camera.updateProjectionMatrix();
			render();
		},
		reset() {
			ansicht();
			render();
		},
		dispose() {
			stopTheme();
			alive = false;
			controls.dispose();
			for (const g of geometrien) g.dispose();
			for (const m of materialien) m.dispose();
			if (initialized) renderer.dispose();
		}
	};
}
