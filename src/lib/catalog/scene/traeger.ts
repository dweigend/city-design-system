import { BLICK } from '../logic/traeger/integration/material';
import type { Analyse, Bauplan } from '../logic/haus-tragwerk';
import * as T from 'three/webgpu';
import { materialColor, mix, uniform } from 'three/tsl';
import { linien, strich } from './schraffur';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { resolveTokens, bindSceneTheme } from './themeBinding';
import { build, type View } from './parametrik';
import { bildpunkt } from './projektion';
import { sceneSwatch } from './scene-palette';
import type { Palette3D } from '../data/city3d';
import type { Primitive } from '../logic/parametrik/types';
import { flowToken, type FlowId } from '../data/focus';
import {
	figurOrt,
	gartenBoeden,
	kanal,
	einheit,
	type Ansicht,
	type Vec3,
	type TraegerPlan,
	type Kante
} from '../logic/traeger';
export type PlatzierterPlan = {
	haus?: Bauplan;
	plan: TraegerPlan;
	schluessel?: string;
	lage: { versatz: Vec3; drehungRad: number };
	fokus: boolean;
};
/** The sole world → three coordinate adapter. */
const welt = ([x, y, z]: Vec3) => new T.Vector3(x, z, -y);
type Update = { entry: PlatzierterPlan; plan: TraegerPlan; update: (p: TraegerPlan) => void };
export function createTraegerSzene(
	canvas: HTMLCanvasElement,
	palette: Palette3D,
	onError: () => void,
	interactive = true
) {
	const renderer = new T.WebGPURenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	renderer.outputColorSpace = T.SRGBColorSpace;
	renderer.toneMapping = T.NoToneMapping;
	const scene = new T.Scene(),
		model = new T.Group();
	scene.add(model);
	const camera = new T.OrthographicCamera(-15, 15, 15, -15, 0.1, 2000);
	const controls = interactive ? new OrbitControls(camera, canvas) : undefined;
	controls?.listenToKeyEvents(canvas);
	let alive = true,
		initialized = false,
		width = 1,
		height = 1,
		mode: Ansicht = 'geruest',
		fixed: View | undefined,
		moved = false,
		fitting = false;
	let updateFigure: (() => void) | undefined;
	let analyse: Analyse | undefined,
		analyseVeraltet = false;
	let blick: Blick = BLICK;
	let fitEntries: PlatzierterPlan[] = [];
	const fitExtras: T.Object3D[] = [];
	const updates: Update[] = [],
		painters: (() => void)[] = [],
		visibility: (() => void)[] = [];
	const render = () => {
		if (alive && initialized) {
			renderer.info.reset();
			renderer.render(scene, camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
			canvas.dataset.drawCalls = String(renderer.info.render.drawCalls);
			canvas.dataset.triangles = String(renderer.info.render.triangles);
			let instances = 0;
			model.traverse((o) => {
				if (o instanceof T.InstancedMesh && o.visible) instances += o.count;
			});
			canvas.dataset.instances = String(instances);
		}
	};
	controls?.addEventListener('change', () => {
		if (!fitting) moved = true;
		render();
	});
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
		.catch((e) => {
			if (alive) onError();
			throw e;
		});
	function applyPalette(p: Palette3D) {
		palette = p;
		for (const paint of painters) paint();
		render();
	}
	const stopTheme = bindSceneTheme(canvas, scene, renderer, applyPalette);
	function material(color: () => string, opacity = 1, hatch = false) {
		const m = new T.MeshBasicNodeMaterial({
			side: T.DoubleSide,
			transparent: opacity < 1,
			opacity,
			depthWrite: opacity === 1
		});
		if (hatch) {
			const ink = uniform(new T.Color(palette.ink));
			m.colorNode = mix(materialColor, ink, strich(linien(45), 0.025).mul(0.22));
			painters.push(() => ink.value.set(palette.ink));
		}
		painters.push(() => m.color.set(color()));
		m.color.set(color());
		return m;
	}
	/** `zurueck`: context that steps back behind an analysis (124 A-01), a light pencil line. */
	function lineMaterial(dashed = false, context = false, zurueck = false) {
		const color = () =>
			context
				? resolveTokens(canvas.parentElement ?? document.documentElement, ['--ink-3'])['--ink-3']
				: palette.ink;
		const opts = {
			color: color(),
			transparent: !context || zurueck,
			opacity: zurueck ? BESTAND_ZURUECK : context ? 1 : 0.62
		};
		const m = dashed
			? new T.LineDashedMaterial({ ...opts, dashSize: 0.18, gapSize: 0.14 })
			: new T.LineBasicMaterial(opts);
		painters.push(() => m.color.set(color()));
		return m;
	}
	function clear() {
		model.traverse((o) => {
			if (o instanceof T.Mesh || o instanceof T.Line) {
				o.geometry.dispose();
				for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
				if (o instanceof T.InstancedMesh) o.dispose();
			}
		});
		model.clear();
		updateFigure = undefined;
		fitExtras.length = 0;
		updates.length = 0;
		painters.length = 0;
		visibility.length = 0;
	}
	function fit(force = false) {
		const box = new T.Box3().setFromObject(model);
		if (box.isEmpty()) return;
		const c = fixed ? welt(fixed.center) : box.getCenter(new T.Vector3());
		if (force || !moved) {
			camera.zoom = 1;
			camera.position
				.copy(c)
				.add(
					(fixed?.eye
						? welt(fixed.eye)
						: new T.Vector3(
								-Math.cos(blick.azimutRad) * Math.cos(blick.hoeheRad),
								Math.sin(blick.hoeheRad),
								Math.sin(blick.azimutRad) * Math.cos(blick.hoeheRad)
							)
					)
						.normalize()
						.multiplyScalar(150)
				);
			camera.lookAt(c);
			controls?.target.copy(c);
			fitting = true;
			controls?.update();
			fitting = false;
		}
		camera.updateMatrixWorld();
		// Fit the projected bounding box, including the 1.8 m figure, to 84% of the stage.
		const projected = new T.Box3();
		for (const entry of fitEntries) {
			const plan = updates.find((u) => u.entry === entry)?.plan ?? entry.plan;
			const gardenNodes = new Set(gartenBoeden(plan).flatMap((f) => f.knoten));
			for (const node of plan.knoten) {
				const point = welt(node.p)
					.applyAxisAngle(new T.Vector3(0, 1, 0), entry.lage.drehungRad)
					.add(welt(entry.lage.versatz));
				projected.expandByPoint(point.clone().applyMatrix4(camera.matrixWorldInverse));
				if (gardenNodes.has(node.id))
					projected.expandByPoint(
						point
							.clone()
							.add(new T.Vector3(0, 1.2, 0))
							.applyMatrix4(camera.matrixWorldInverse)
					);
			}
		}
		for (const extra of fitExtras) {
			const bounds = new T.Box3().setFromObject(extra);
			for (const x of [bounds.min.x, bounds.max.x])
				for (const y of [bounds.min.y, bounds.max.y])
					for (const z of [bounds.min.z, bounds.max.z])
						projected.expandByPoint(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
		}
		projected.expandByScalar(0.22);
		if (!fixed && (force || !moved)) {
			const offset = projected.getCenter(new T.Vector3());
			offset.z = 0;
			offset.applyQuaternion(camera.quaternion);
			camera.position.add(offset);
			controls?.target.add(offset);
			camera.updateMatrixWorld();
		}
		const size = projected.getSize(new T.Vector3());
		const span = fixed?.span ?? Math.max(size.y, (size.x * height) / width) / 0.84;
		camera.top = Math.max(0.1, span / 2);
		camera.bottom = -camera.top;
		camera.right = (camera.top * width) / height;
		camera.left = -camera.right;
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
		render();
	}
	function project(entry: PlatzierterPlan) {
		const group = new T.Group();
		group.position.copy(welt(entry.lage.versatz));
		group.rotation.y = entry.lage.drehungRad;
		model.add(group);
		const p = entry.plan;
		const tasks: ((p: TraegerPlan, nodes: Map<string, Vec3>) => void)[] = [];
		for (const role of ['stab', 'nebenstab', 'rippe', 'berg', 'rand'] as const) {
			const edges = p.kanten.filter((e) => e.rolle === role);
			if (!edges.length || !entry.fokus || entry.haus) continue;
			const radius = { stab: 0.09, nebenstab: 0.05, rippe: 0.07, berg: 0.04, rand: 0.04 }[role];
			const mesh = new T.InstancedMesh(
				new T.CylinderGeometry(radius, radius, 1, 8),
				material(() => palette.ink),
				edges.length
			);
			group.add(mesh);
			tasks.push((plan, nodes) => {
				// Keep projected rod weight proportional to model size, within ±50% of contract.
				const scale = role === 'berg' || role === 'rand' ? 1 : stabSkalierung(plan);
				const edgeMap = new Map(plan.kanten.map((e) => [e.id, e]));
				const obj = new T.Object3D();
				edges.forEach((edge, i) => {
					const e = edgeMap.get(edge.id) ?? edge,
						a = welt(nodes.get(e.a) ?? [0, 0, 0]),
						b = welt(nodes.get(e.b) ?? [0, 0, 0]),
						d = b.clone().sub(a);
					obj.position.copy(a).add(b).multiplyScalar(0.5);
					obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
					obj.scale.set(scale, d.length(), scale);
					obj.updateMatrix();
					mesh.setMatrixAt(i, obj.matrix);
				});
				mesh.instanceMatrix.needsUpdate = true;
				mesh.computeBoundingSphere();
				mesh.computeBoundingBox();
			});
		}
		if (entry.fokus && !entry.haus && (p.familie === 'kuppel' || p.familie === 'raumfachwerk')) {
			const mesh = new T.InstancedMesh(
				new T.SphereGeometry(0.198, 10, 6),
				material(() => palette.ink),
				p.knoten.length
			);
			group.add(mesh);
			tasks.push((plan) => {
				const obj = new T.Object3D();
				obj.scale.setScalar(stabSkalierung(plan));
				plan.knoten.forEach((n, i) => {
					obj.position.copy(welt(n.p));
					obj.updateMatrix();
					mesh.setMatrixAt(i, obj.matrix);
				});
				mesh.instanceMatrix.needsUpdate = true;
				mesh.computeBoundingSphere();
				mesh.computeBoundingBox();
			});
		}
		const makeLines = (edges: Kante[], dashed: boolean) => {
			if (!edges.length) return;
			const geometry = new T.BufferGeometry();
			const data = new Float32Array(edges.length * 6);
			geometry.setAttribute('position', new T.BufferAttribute(data, 3));
			const lines = new T.LineSegments(
				geometry,
				lineMaterial(dashed, !entry.fokus || (!!analyse && !!entry.haus))
			);
			group.add(lines);
			tasks.push((_, nodes) => {
				edges.forEach((e, i) => {
					welt(nodes.get(e.a) ?? [0, 0, 0]).toArray(data, i * 6);
					welt(nodes.get(e.b) ?? [0, 0, 0]).toArray(data, i * 6 + 3);
				});
				geometry.attributes.position.needsUpdate = true;
				geometry.computeBoundingSphere();
				geometry.computeBoundingBox();
				if (dashed) lines.computeLineDistances();
			});
		};
		makeLines(
			p.kanten.filter((e) => e.rolle !== 'tal'),
			false
		);
		makeLines(
			p.kanten.filter((e) => e.rolle === 'tal'),
			true
		);
		const statik = entry.fokus ? entry.haus?.statik : undefined;
		if (statik && entry.haus) {
			if (analyse) projectAnalyse(group, analyse);
			else projectStatik(group, entry.haus, statik);
			projectLager(group, entry.haus, statik);
		}
		const cellOwner = new Map<string, string[]>();
		for (const c of p.zellen)
			for (const id of c.flaechen) cellOwner.set(id, [...(cellOwner.get(id) ?? []), c.id]);
		const buckets = new Map<string, typeof p.flaechen>();
		for (const f of p.flaechen) {
			if (f.rolle === 'offen' || !entry.fokus) continue;
			const flow =
				p.belegung[f.id] ??
				(cellOwner.get(f.id) ?? []).map((id) => p.belegung[id]).find((v) => v && v !== 'leer') ??
				'leer';
			const key = `${f.rolle}:${flow}`;
			buckets.set(key, [...(buckets.get(key) ?? []), f]);
		}
		for (const [key, faces] of buckets) {
			const [role, flow] = key.split(':');
			const transparent = role === 'glas' || role === 'membran';
			const color = () =>
				mode === 'belegt' && flow !== 'leer' && !(entry.haus && flow === 'food')
					? sceneSwatch(palette, flowToken[flow as FlowId])
					: palette.paper;
			const m = material(color, transparent ? 0.25 : 1, role === 'paneel');
			const geometry = new T.BufferGeometry();
			// Triangle vertex recipes retain topology while only their position buffer changes.
			const recipes: { id: string; down: boolean }[] = [];
			for (const f of faces) {
				const ring = f.knoten;
				for (let i = 1; i + 1 < ring.length; i++) {
					for (const id of [ring[0], ring[i], ring[i + 1]]) recipes.push({ id, down: false });
					if (role === 'boden')
						for (const id of [ring[0], ring[i + 1], ring[i]]) recipes.push({ id, down: true });
				}
				if (role === 'boden')
					for (let i = 0; i < ring.length; i++) {
						const a = ring[i],
							b = ring[(i + 1) % ring.length];
						recipes.push(
							{ id: a, down: false },
							{ id: a, down: true },
							{ id: b, down: true },
							{ id: a, down: false },
							{ id: b, down: true },
							{ id: b, down: false }
						);
					}
			}
			const data = new Float32Array(recipes.length * 3);
			geometry.setAttribute('position', new T.BufferAttribute(data, 3));
			const mesh = new T.Mesh(geometry, m);
			group.add(mesh);
			visibility.push(() => {
				mesh.visible = mode !== 'geruest';
				m.color.set(color());
				m.opacity = transparent ? (mode === 'belegt' && flow !== 'leer' ? 0.75 : 0.25) : 1;
			});
			tasks.push((_, nodes) => {
				recipes.forEach((r, i) => {
					const v = welt(nodes.get(r.id) ?? [0, 0, 0]);
					if (r.down) v.y -= 0.25;
					v.toArray(data, i * 3);
				});
				geometry.attributes.position.needsUpdate = true;
				geometry.computeBoundingSphere();
				geometry.computeBoundingBox();
			});
		}

		if (entry.fokus) {
			const floors = entry.haus && p.familie !== 'wabe' ? [] : gartenBoeden(p);
			if (floors.length) {
				const beds = new T.InstancedMesh(
					new T.BoxGeometry(1, 0.18, 1),
					material(() => sceneSwatch(palette, '--cat-nature')),
					floors.length * 2
				);
				const trees = new T.InstancedMesh(
					new T.SphereGeometry(0.45, 10, 6),
					material(() => sceneSwatch(palette, '--cat-nature')),
					floors.length * 3
				);
				group.add(beds, trees);
				visibility.push(() => {
					beds.visible = trees.visible = mode === 'belegt';
				});
				tasks.push((plan, nodes) => {
					const obj = new T.Object3D();
					floors.forEach((floor, i) => {
						const ring = floor.knoten.map((id) => nodes.get(id) ?? ([0, 0, 0] as Vec3));
						const center = ring.reduce<Vec3>(
							(sum, v) => [
								sum[0] + v[0] / ring.length,
								sum[1] + v[1] / ring.length,
								sum[2] + v[2] / ring.length
							],
							[0, 0, 0]
						);
						const radius =
							Math.min(...ring.map((v) => Math.hypot(v[0] - center[0], v[1] - center[1]))) * 0.32;
						for (let j = 0; j < 2; j++) {
							obj.position.copy(
								welt([center[0], center[1] + (j ? 1 : -1) * radius * 0.65, center[2] + 0.1])
							);
							obj.scale.set(radius * 1.5, 1, radius * 0.65);
							obj.updateMatrix();
							beds.setMatrixAt(i * 2 + j, obj.matrix);
						}
						for (let j = 0; j < 3; j++) {
							const u = einheit(kanal(plan.saat, plan.familie, `${floor.id}:${j}`, 'garten'));
							const angle = ((j + u * 0.4) * Math.PI * 2) / 3;
							obj.position.copy(
								welt([
									center[0] + Math.cos(angle) * radius * 1.7,
									center[1] + Math.sin(angle) * radius * 1.7,
									center[2] + 0.65
								])
							);
							obj.scale.setScalar(Math.min(1, radius));
							obj.updateMatrix();
							trees.setMatrixAt(i * 3 + j, obj.matrix);
						}
					});
					for (const mesh of [beds, trees]) {
						mesh.instanceMatrix.needsUpdate = true;
						mesh.computeBoundingSphere();
						mesh.computeBoundingBox();
					}
				});
			}
		}

		if (entry.haus && entry.fokus) {
			const haus = entry.haus;
			for (const einbau of haus.einbauten) {
				const a = haus.anschluesse.find((a) => a.id === einbau.anschlussId);
				if (!a || (haus.familie === 'wabe' && a.art === 'raum')) continue;
				if (a.art === 'garten') {
					const minX = Math.min(...a.polygon.map((p) => p[0])),
						maxX = Math.max(...a.polygon.map((p) => p[0]));
					const minY = Math.min(...a.polygon.map((p) => p[1])),
						maxY = Math.max(...a.polygon.map((p) => p[1]));
					const inside = (x: number, y: number) =>
						a.polygon.every((p, i) => {
							const q = a.polygon[(i + 1) % a.polygon.length];
							return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]) >= 0;
						});
					for (let x = minX + 0.3; x + 0.8 < maxX; x += 1.3)
						for (let y = minY + 0.3; y + 0.8 < maxY; y += 1.3) {
							if (
								![
									[x, y],
									[x + 0.8, y],
									[x + 0.8, y + 0.8],
									[x, y + 0.8]
								].every(([x, y]) => inside(x, y))
							)
								continue;
							const bed = new T.BoxGeometry(0.8, 0.35, 0.8);
							bed.translate(x + 0.4, a.z + 0.175, -y - 0.4);
							const mesh = new T.Mesh(
								bed,
								// In the analysis view no flow colour is shown (124 A-01).
								material(() => (analyse ? palette.paper : sceneSwatch(palette, '--cat-nature')))
							);
							group.add(mesh, new T.LineSegments(new T.EdgesGeometry(bed), lineMaterial()));
							visibility.push(() => {
								mesh.visible = mode !== 'geruest';
							});
						}
					continue;
				}
				let geometry: T.BufferGeometry;
				if (a.huelle && a.art === 'raum') {
					const r = a.huelle.radiusM,
						h = a.hoeheM / 2;
					geometry = new T.SphereGeometry(
						r,
						32,
						24,
						0,
						Math.PI * 2,
						Math.acos(h / r),
						2 * Math.asin(h / r)
					);
					geometry.translate(a.huelle.zentrum[0], a.huelle.zentrum[2], -a.huelle.zentrum[1]);
					for (const z of [a.z, a.z + a.hoeheM]) {
						const cap = new T.CircleGeometry(Math.sqrt(r * r - h * h), 32);
						cap.rotateX(-Math.PI / 2);
						cap.translate(a.huelle.zentrum[0], z, -a.huelle.zentrum[1]);
						group.add(
							new T.Mesh(
								cap,
								material(() => palette.paper)
							)
						);
					}
				} else {
					const b = build({
						id: einbau.id,
						kind: 'prism',
						polygon: a.polygon,
						z: a.z,
						height: a.hoeheM,
						role: 'neu',
						token: '--paper',
						material: 'concrete'
					});
					geometry = b.geometry;
					geometry.translate(b.position.x, b.position.y, b.position.z);
				}
				const color = () =>
					mode === 'belegt' ? sceneSwatch(palette, flowToken[einbau.nutzung]) : palette.paper;
				const mesh = new T.Mesh(geometry, material(color));
				const lines = new T.LineSegments(new T.EdgesGeometry(geometry, 30), lineMaterial());
				group.add(mesh, lines);
				visibility.push(() => {
					mesh.visible = mode !== 'geruest';
					(mesh.material as T.MeshBasicNodeMaterial).color.set(color());
				});
				if (a.beziehung === 'eingehaengt') {
					const positions: number[] = [];
					for (const fassung of a.fassungen ?? []) {
						const node = haus.traeger.knoten.find((n) => n.id === fassung.knotenId);
						if (node) positions.push(...welt(node.p).toArray(), ...welt(fassung.p).toArray());
					}

					const g = new T.BufferGeometry();
					g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
					group.add(new T.LineSegments(g, lineMaterial()));
				}
			}
			const [x, y, z] = haus.eingang.p;
			const [tx, ty] = haus.anschluesse.find(
				(a) => a.art === 'raum' && a.tuer.p.every((v, i) => v === haus.eingang.p[i])
			)?.tuer.tangente ?? [1, 0];
			const door = new T.BufferGeometry().setFromPoints(
				[
					[x - tx * 0.75, y - ty * 0.75, z],
					[x - tx * 0.75, y - ty * 0.75, z + 2.1],
					[x + tx * 0.75, y + ty * 0.75, z + 2.1],
					[x + tx * 0.75, y + ty * 0.75, z]
				].map((p) => welt(p as Vec3))
			);
			const opening = new T.BufferGeometry().setFromPoints(
				[
					[x - tx * 0.75 + ty * 0.05, y - ty * 0.75 - tx * 0.05, z],
					[x + tx * 0.75 + ty * 0.05, y + ty * 0.75 - tx * 0.05, z],
					[x + tx * 0.75 + ty * 0.05, y + ty * 0.75 - tx * 0.05, z + 2.1],
					[x - tx * 0.75 + ty * 0.05, y - ty * 0.75 - tx * 0.05, z + 2.1]
				].map((p) => welt(p as Vec3))
			);
			opening.setIndex([0, 1, 2, 0, 2, 3]);
			const doorMesh = new T.Mesh(
				opening,
				material(() => palette.paper)
			);
			group.add(doorMesh, new T.Line(door, lineMaterial()));
		}

		const update = (plan: TraegerPlan) => {
			const nodes = new Map(plan.knoten.map((n) => [n.id, n.p]));
			for (const task of tasks) task(plan, nodes);
		};
		update(p);
		updates.push({ entry, plan: p, update });
	}
	/**
	 * Sized members at their true diameters. A tube that takes compression is drawn hollow (paper
	 * core, ink wall), a rod that only pulls is a solid ink line: force reads from the weight of
	 * the stroke, its sign from hollow or solid. No colour, no scaling of plan coordinates.
	 */
	function projectStatik(group: T.Group, haus: Bauplan, statik: NonNullable<Bauplan['statik']>) {
		const ort = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
		type Strecke = { a: Vec3; b: Vec3; durchmesserM: number; druck: boolean };
		const strecken: Strecke[] = [];
		for (const k of haus.traeger.kanten) {
			const s = statik.staebe[k.id],
				a = ort.get(k.a),
				b = ort.get(k.b);
			if (s && a && b) strecken.push({ a, b, durchmesserM: s.durchmesserM, druck: s.druck });
		}
		const haengt = haus.einbauten.some((e) =>
			haus.anschluesse.some((a) => a.id === e.anschlussId && a.beziehung === 'eingehaengt')
		);
		if (haengt)
			for (const h of statik.haenger) {
				const a = ort.get(h.knotenId);
				if (a) strecken.push({ a, b: h.p, durchmesserM: h.durchmesserM, druck: h.druck });
			}
		const zylinder = (liste: Strecke[], anteil: number, m: T.Material) => {
			if (!liste.length) return;
			const mesh = new T.InstancedMesh(
				new T.CylinderGeometry(0.5, 0.5, 1, 12, 1, true),
				m,
				liste.length
			);
			const obj = new T.Object3D();
			liste.forEach((s, i) => {
				const a = welt(s.a),
					b = welt(s.b),
					d = b.clone().sub(a);
				obj.position.copy(a).add(b).multiplyScalar(0.5);
				obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
				obj.scale.set(s.durchmesserM * anteil, d.length(), s.durchmesserM * anteil);
				obj.updateMatrix();
				mesh.setMatrixAt(i, obj.matrix);
			});
			mesh.instanceMatrix.needsUpdate = true;
			mesh.computeBoundingSphere();
			group.add(mesh);
		};
		const rohre = strecken.filter((s) => s.druck),
			seile = strecken.filter((s) => !s.druck);
		zylinder(
			seile,
			1,
			material(() => palette.ink)
		);
		// Hollow tube: the far inner wall in ink gives the outline, a paper core lies in front.
		const wand = material(() => palette.ink);
		wand.side = T.BackSide;
		zylinder(rohre, 1, wand);
		const kern = material(() => palette.paper);
		kern.side = T.FrontSide;
		zylinder(rohre, ROHR_KERN_ANTEIL, kern);
		// Hubs: one ink ball per joint, as large as its thickest member needs.
		const dicke = new Map<string, number>();
		for (const s of strecken)
			for (const p of [s.a, s.b]) {
				const key = p.join(',');
				dicke.set(key, Math.max(dicke.get(key) ?? 0, s.durchmesserM));
			}
		const naben = new T.InstancedMesh(
			new T.SphereGeometry(0.5, 12, 8),
			material(() => palette.ink),
			dicke.size
		);
		const obj = new T.Object3D();
		[...dicke].forEach(([key, d], i) => {
			obj.position.copy(welt(key.split(',').map(Number) as Vec3));
			obj.scale.setScalar(Math.max(NABE_MIN_M, d * NABE_ANTEIL));
			obj.updateMatrix();
			naben.setMatrixAt(i, obj.matrix);
		});
		naben.instanceMatrix.needsUpdate = true;
		naben.computeBoundingSphere();
		group.add(naben);
	}
	/** Bearing shoes on the wall crowns: square holds, long slides. */
	function projectLager(group: T.Group, haus: Bauplan, statik: NonNullable<Bauplan['statik']>) {
		const ort = new Map(haus.traeger.knoten.map((n) => [n.id, n.p]));
		for (const l of statik.lager) {
			const p = ort.get(l.knotenId);
			if (!p) continue;
			const schuh = new T.Mesh(
				new T.BoxGeometry(
					l.art === 'fest' ? 0.6 : 0.9,
					LAGER_HOEHE_M,
					l.art === 'fest' ? 0.6 : 0.36
				),
				material(() => palette.ink)
			);
			schuh.position.copy(welt([p[0], p[1], p[2] + LAGER_HOEHE_M / 2]));
			group.add(schuh);
		}
	}
	/**
	 * Analysis view (124 A-01 to A-05): members in the colour of their class, tension solid and
	 * compression hollow as in the plain view. The only place where colour means something other
	 * than use. Colours are tokens of app.css and follow the theme. Thin rods are drawn at least
	 * `ANALYSE_MIN_M` thick so that their colour stays readable; a stale result fades.
	 */
	function projectAnalyse(group: T.Group, a: Analyse) {
		const host = canvas.parentElement ?? document.documentElement;
		const tokens = a.klassen.map((k) => k.token);
		const spur = () => Number(getComputedStyle(host).getPropertyValue('--alpha-trace')) || 0.12;
		const farbe = (index: number, side: T.Side) => {
			const m = new T.MeshBasicNodeMaterial({ side, transparent: analyseVeraltet });
			const male = () => {
				m.color.set(resolveTokens(host, tokens)[tokens[index]]);
				m.opacity = analyseVeraltet ? spur() : 1;
			};
			painters.push(male);
			male();
			return m;
		};
		const zylinder = (liste: Analyse['strecken'], anteil: number, m: T.Material) => {
			if (!liste.length) return;
			const mesh = new T.InstancedMesh(
				new T.CylinderGeometry(0.5, 0.5, 1, 12, 1, true),
				m,
				liste.length
			);
			const obj = new T.Object3D();
			liste.forEach((s, i) => {
				const p = welt(s.a),
					q = welt(s.b),
					d = q.clone().sub(p),
					dicke = Math.max(ANALYSE_MIN_M, s.durchmesserM) * anteil;
				obj.position.copy(p).add(q).multiplyScalar(0.5);
				obj.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
				obj.scale.set(dicke, d.length(), dicke);
				obj.updateMatrix();
				mesh.setMatrixAt(i, obj.matrix);
			});
			mesh.instanceMatrix.needsUpdate = true;
			mesh.computeBoundingSphere();
			group.add(mesh);
		};
		a.klassen.forEach((_, index) => {
			const liste = a.strecken.filter((s) => s.klasse === index);
			zylinder(
				liste.filter((s) => !s.druck),
				1,
				farbe(index, T.DoubleSide)
			);
			zylinder(
				liste.filter((s) => s.druck),
				1,
				farbe(index, T.BackSide)
			);
		});
		const kern = material(() => palette.paper);
		kern.side = T.FrontSide;
		zylinder(
			a.strecken.filter((s) => s.druck),
			ROHR_KERN_ANTEIL,
			kern
		);
		// Floor ribs of the hung capsule: where the load enters the hangers. No value, no colour.
		if (a.rippen.length) {
			const geometry = new T.BufferGeometry().setFromPoints(
				a.rippen.flatMap(([p, q]) => [welt(p), welt(q)])
			);
			group.add(new T.LineSegments(geometry, lineMaterial(false, true)));
		}
	}
	function setze(
		plaene: PlatzierterPlan[],
		bestand: Primitive[] = [],
		ansicht: Ansicht = 'geruest',
		optionen: {
			figur?: Vec3;
			figuren?: Vec3[];
			hochweg?: Primitive[];
			view?: View;
			analyse?: Analyse;
			analyseVeraltet?: boolean;
			/** Start direction of the camera; default is the shared isometric `BLICK`. */
			blick?: Blick;
		} = {}
	) {
		canvas.dataset.aufbauten = String(Number(canvas.dataset.aufbauten ?? 0) + 1);
		clear();
		mode = ansicht;
		fitEntries = plaene;
		fixed = optionen.view;
		analyse = optionen.analyse;
		analyseVeraltet = optionen.analyseVeraltet ?? false;
		const neuerBlick = optionen.blick ?? BLICK;
		const blickGeaendert =
			neuerBlick.azimutRad !== blick.azimutRad || neuerBlick.hoeheRad !== blick.hoeheRad;
		blick = neuerBlick;
		for (const entry of plaene) project(entry);
		// Transform all context edges into one world-space buffer (one draw call).
		const contextPositions: number[] = [];
		for (const p of bestand) {
			if (p.kind === 'polyline') {
				const points = p.closed ? [...p.points, p.points[0]] : p.points;
				for (let i = 1; i < points.length; i++)
					for (const v of [points[i - 1], points[i]]) contextPositions.push(...welt(v).toArray());
			} else {
				const b = build(p);
				if (plaene.some((e) => e.haus) && p.kind === 'box') {
					// Behind an analysis the stock is paper with a pencil outline (124 A-01).
					const mesh = new T.Mesh(
						b.geometry.clone(),
						material(() =>
							new T.Color(palette.paper)
								.lerp(new T.Color(palette.ink), analyse ? 0 : 0.06)
								.getStyle()
						)
					);
					mesh.position.copy(b.position);
					mesh.rotation.y = b.rotation;
					model.add(mesh);
					fitExtras.push(mesh);
				}
				const g = new T.EdgesGeometry(b.geometry, b.edgeAngle);
				const transform = new T.Matrix4().makeRotationY(b.rotation).setPosition(b.position);
				const attr = g.getAttribute('position');
				for (let i = 0; i < attr.count; i++)
					contextPositions.push(
						...new T.Vector3().fromBufferAttribute(attr, i).applyMatrix4(transform).toArray()
					);
				g.dispose();
				b.geometry.dispose();
			}
		}
		if (contextPositions.length) {
			const geometry = new T.BufferGeometry();
			geometry.setAttribute('position', new T.Float32BufferAttribute(contextPositions, 3));
			const lines = new T.LineSegments(geometry, lineMaterial(false, true, !!analyse));
			model.add(lines);
			fitExtras.push(lines);
		}
		for (const p of optionen.hochweg ?? []) {
			if (p.kind === 'polyline') {
				const g = new T.BufferGeometry().setFromPoints(p.points.map(welt));
				const context = p.token === '--paper' || plaene.some((e) => !e.fokus);
				const m = context
					? lineMaterial(false, true)
					: new T.LineBasicMaterial({ color: sceneSwatch(palette, '--cat-business') });
				if (!context) painters.push(() => m.color.set(sceneSwatch(palette, '--cat-business')));
				const line = new T.Line(g, m);
				model.add(line);
				fitExtras.push(line);
			} else {
				const b = build(p),
					mesh = new T.Mesh(
						b.geometry,
						material(() => palette.paper)
					);
				mesh.position.copy(b.position);
				mesh.rotation.y = b.rotation;
				const edges = new T.LineSegments(
					new T.EdgesGeometry(b.geometry, b.edgeAngle),
					lineMaterial(false, true)
				);
				mesh.add(edges);
				model.add(mesh);
				fitExtras.push(mesh);
			}
		}
		const focal = plaene.find((e) => e.fokus);
		for (const figur of optionen.figuren ?? [optionen.figur]) {
			if (figur || focal) {
				const figure = new T.Group();
				const moveFigure = () => {
					if (figur) figure.position.copy(welt(figur));
					else if (focal) {
						const plan = updates.find((u) => u.entry === focal)?.plan ?? focal.plan;
						figure.position
							.copy(welt(figurOrt(plan)))
							.applyAxisAngle(new T.Vector3(0, 1, 0), focal.lage.drehungRad)
							.add(welt(focal.lage.versatz));
					}
				};
				moveFigure();
				updateFigure = moveFigure;
				const body = new T.Mesh(
					new T.CylinderGeometry(0.11, 0.14, 1.42, 8),
					material(() => palette.ink)
				);
				body.position.y = 0.71;
				figure.add(body);
				const head = new T.Mesh(
					new T.SphereGeometry(0.19, 10, 8),
					material(() => palette.ink)
				);
				head.position.y = 1.61;
				figure.add(head);
				model.add(figure);
				fitExtras.push(figure);
			}
		}
		for (const show of visibility) show();
		fit(blickGeaendert && !moved);
	}
	const topology = (p: TraegerPlan) =>
		JSON.stringify([
			p.familie,
			p.knoten.map((n) => n.id),
			p.kanten,
			p.flaechen,
			p.zellen.map((z) => [z.id, z.flaechen, z.nutzung])
		]);
	return {
		ready,
		camera,
		setze,
		ansicht(a: Ansicht) {
			mode = a;
			for (const show of visibility) show();
			render();
		},
		aktualisiere(plan: TraegerPlan, schluessel?: string) {
			const matches = updates.filter((u) =>
				schluessel === undefined
					? u.plan.familie === plan.familie
					: u.entry.schluessel === schluessel
			);
			for (const u of matches) {
				if (topology(u.plan) !== topology(plan))
					throw new Error('aktualisiere requires identical topology');
				u.update(plan);
				u.plan = plan;
			}
			updateFigure?.();
			if (!moved) fit();
			else render();
		},
		palette: applyPalette,
		bildpunkt(p: Vec3) {
			return bildpunkt(camera, p, width, height);
		},
		resize(w: number, h: number) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			renderer.setSize(width, height, false);
			fit();
		},
		reset() {
			moved = false;
			fit(true);
		},
		fit() {
			fit(true);
		},
		dispose() {
			alive = false;
			stopTheme();
			controls?.dispose();
			clear();
			if (initialized) renderer.dispose();
		}
	};
}

/** Camera direction as azimuth and elevation, radians (see `BLICK`). */
export type Blick = { azimutRad: number; hoeheRad: number };
/** Opacity of stock outlines behind an analysis view. */
const BESTAND_ZURUECK = 0.4;
/** Paper core of a drawn tube as a share of its diameter; the rest reads as the ink wall. */
const ROHR_KERN_ANTEIL = 0.62;
/** Hub ball: diameter as a multiple of the thickest member at the joint, with a floor in metres. */
const NABE_ANTEIL = 1.5;
const NABE_MIN_M = 0.1;
const LAGER_HOEHE_M = 0.14;
/** Smallest drawn thickness of a member in the analysis view, metres. */
const ANALYSE_MIN_M = 0.09;
/** Model-relative visual thickness; physical plan coordinates stay unchanged. */
function stabSkalierung(plan: TraegerPlan) {
	const span = Math.max(
		...[0, 1, 2].map(
			(i) =>
				Math.max(...plan.knoten.map((n) => n.p[i])) - Math.min(...plan.knoten.map((n) => n.p[i]))
		)
	);
	return Math.max(0.5, Math.min(1.5, span / 250 / 0.09));
}
