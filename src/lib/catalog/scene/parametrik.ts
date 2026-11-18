import { bindSceneTheme } from './themeBinding';
import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { surfaceColor, outlinePosition } from './surfaces';
import { edgeColor, finishMaterial, lookColor } from './material';
import { pocheColor } from './schnitt';
import { materialLook, resolveMaterial, usesMaterialSystem } from '../logic/parametrik/material';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Palette3D } from '../data/city3d';
import type { Primitive, Vec3 } from '../logic/parametrik/types';
import { defaultStyle, type SceneStyle } from '../logic/parametrik/style';
import { fein, grob, kreisSegmente } from '../logic/parametrik/rundung';

const vector = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);
/**
 * Fixed framing (same camera for every vignette): look at centre, half height span in metres.
 * eye: world direction toward the camera (default isometric); straight down keeps north up.
 */
export type View = { center: Vec3; span: number; eye?: Vec3 };
/** Optional grouping for the view layer: groups move as a whole (explosion, build phases). */
export type GroupOf = (p: Primitive) => string;
export type Built = {
	geometry: THREE.BufferGeometry;
	position: THREE.Vector3;
	rotation: number;
	/** EdgesGeometry threshold in degrees. */
	edgeAngle: number;
	outline: boolean;
	double?: boolean;
	/** false: no crease edges (space frames draw centre lines instead). */
	edges?: boolean;
	/** Extra line segments (three coordinates, local), e.g. membrane rulings. */
	rulings?: number[];
};
/**
 * Primitive → local geometry plus placement. World x/y/z ↔ three x/−z/y (see vector).
 * Round parts: segments per full circle from a chord tolerance in metres (logic/parametrik/rundung).
 * `coarse`: larger tolerance, for scenes with thousands of primitives (L11).
 */
export function build(p: Exclude<Primitive, { kind: 'polyline' }>, coarse = false): Built {
	/** Segments along a path or spiral (not around a circle). */
	const seg = (n: number) => (coarse ? Math.max(6, Math.round(n * 0.4)) : n);
	/** Segments around a full circle of radius r. */
	const round = (r: number) => kreisSegmente(r, coarse ? grob : fein);
	const at = (position: THREE.Vector3, geometry: THREE.BufferGeometry, more?: Partial<Built>) => ({
		geometry,
		position,
		rotation: p.rotation ?? 0,
		edgeAngle: 46,
		outline: false,
		...more
	});
	switch (p.kind) {
		case 'prism': {
			const shape = new THREE.Shape(p.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
			for (const hole of p.holes ?? [])
				shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
			const geometry = new THREE.ExtrudeGeometry(shape, { depth: p.height, bevelEnabled: false });
			// Shape x/y → world x/-z (see vector), extrusion → up.
			geometry.rotateX(-Math.PI / 2);
			geometry.translate(0, p.z, 0);
			return at(new THREE.Vector3(), geometry);
		}
		case 'box':
			return at(
				vector([
					p.position[0] + p.size[0] / 2,
					p.position[1] + p.size[1] / 2,
					p.position[2] + p.size[2] / 2
				]),
				new THREE.BoxGeometry(p.size[0], p.size[2], p.size[1])
			);
		case 'pipe': {
			const curve = new THREE.CatmullRomCurve3(p.points.map(vector));
			// A straight pipe needs one segment along its length; curved paths keep the fine sampling.
			const along = p.points.length === 2 ? 1 : seg(96);
			const geometry = new THREE.TubeGeometry(curve, along, p.radius, round(p.radius), false);
			return at(new THREE.Vector3(), geometry, { outline: true });
		}
		case 'ring': {
			if (p.curvature && p.curvature > p.radius) {
				// Shell on a sphere (Bullauge): the front follows the sphere, revolved around the axis.
				// Front steps from the same chord tolerance: a chord of length d on a circle of
				// radius R sags d² / (8R). The back lies under the skin and stays one straight chord.
				const R = p.curvature,
					h = (r: number) => Math.sqrt(R * R - r * r) - R,
					tolerance = coarse ? grob.tolerance : fein.tolerance,
					steps = Math.max(1, Math.ceil((p.radius - p.innerRadius) / Math.sqrt(8 * R * tolerance))),
					front: THREE.Vector2[] = [];
				for (let i = 0; i <= steps; i++) {
					const r = p.radius - ((p.radius - p.innerRadius) * i) / steps;
					front.push(new THREE.Vector2(r, h(r) + p.depth / 2));
				}
				const back = (r: number) => new THREE.Vector2(r, h(p.radius) - p.depth / 2);
				// Lathe revolves around local y. Profile inner back → outer → inner front keeps the
				// normals outward (the outline hull extrudes along them).
				const geometry = new THREE.LatheGeometry(
					[back(p.innerRadius), back(p.radius), ...front, back(p.innerRadius)],
					round(p.radius)
				);
				geometry.rotateZ(-Math.PI / 2);
				if (p.tilt) geometry.rotateZ(p.tilt);
				return at(vector(p.position), geometry, { outline: true, edgeAngle: 40 });
			}
			const shape = new THREE.Shape();
			shape.absarc(0, 0, p.radius, 0, Math.PI * 2, false);
			// innerRadius 0: solid disc (window pane).
			if (p.innerRadius > 0) {
				const hole = new THREE.Path();
				hole.absarc(0, 0, p.innerRadius, 0, Math.PI * 2, true);
				shape.holes.push(hole);
			}
			// Ellipse curves sample 2 × curveSegments points per full circle.
			const geometry = new THREE.ExtrudeGeometry(shape, {
				depth: p.depth,
				bevelEnabled: false,
				curveSegments: round(p.radius) / 2
			});
			geometry.translate(0, 0, -p.depth / 2);
			geometry.rotateY(Math.PI / 2);
			// Axis along local x, tilted up by `tilt` before the turn in plan.
			if (p.tilt) geometry.rotateZ(p.tilt);
			return at(vector(p.position), geometry, { outline: true });
		}
		case 'cylinder':
		case 'cone':
			return at(
				vector([p.position[0], p.position[1], p.position[2] + p.height / 2]),
				new THREE.CylinderGeometry(
					p.kind === 'cone' ? 0 : p.radius,
					p.radius,
					p.height,
					round(p.radius)
				),
				{ outline: true }
			);
		case 'sphere': {
			const n = round(p.radius);
			const geometry = new THREE.SphereGeometry(p.radius, n, n / 2);
			geometry.scale(1, p.squash ?? 1, 1);
			return at(vector(p.position), geometry, { outline: true });
		}
		case 'dome': {
			const rise = (p.height ?? p.radius) / p.radius;
			let geometry: THREE.BufferGeometry;
			if (p.facets) {
				// Geodesic: icosahedron, upper half kept, the cut ring flattened onto the base.
				const ico = new THREE.IcosahedronGeometry(p.radius, Math.round(p.facets));
				const src = ico.getAttribute('position');
				const keep: number[] = [];
				for (let i = 0; i < src.count; i += 3) {
					const cy = (src.getY(i) + src.getY(i + 1) + src.getY(i + 2)) / 3;
					if (cy <= 0) continue;
					for (let k = 0; k < 3; k++)
						keep.push(src.getX(i + k), Math.max(0, src.getY(i + k)), src.getZ(i + k));
				}
				ico.dispose();
				geometry = new THREE.BufferGeometry();
				geometry.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
				geometry.setAttribute(
					'uv',
					new THREE.Float32BufferAttribute(new Array((keep.length / 3) * 2).fill(0), 2)
				);
				geometry.computeVertexNormals();
			} else
				geometry = new THREE.SphereGeometry(
					p.radius,
					round(p.radius),
					round(p.radius) / 4,
					0,
					Math.PI * 2,
					0,
					Math.PI / 2
				);
			geometry.scale(1, rise, 1);
			return at(vector(p.position), geometry, {
				outline: true,
				edgeAngle: p.facets ? 1 : 46
			});
		}
		case 'capsule': {
			const a = vector(p.from),
				b = vector(p.to),
				dir = b.clone().sub(a),
				length = dir.length();
			const geometry = new THREE.CapsuleGeometry(
				p.radius,
				Math.max(0.001, length),
				round(p.radius) / 4,
				round(p.radius)
			);
			geometry.applyQuaternion(
				new THREE.Quaternion().setFromUnitVectors(
					new THREE.Vector3(0, 1, 0),
					dir.normalize().lengthSq() ? dir : new THREE.Vector3(0, 1, 0)
				)
			);
			return at(a.add(b).multiplyScalar(0.5), geometry, { outline: true, rotation: 0 });
		}
		case 'wedge': {
			const [w, d, h] = p.size,
				low = Math.max(0, Math.min(1, p.low ?? 0));
			const shape = new THREE.Shape([
				new THREE.Vector2(-w / 2, -h / 2),
				new THREE.Vector2(w / 2, -h / 2),
				new THREE.Vector2(w / 2, -h / 2 + low * h),
				new THREE.Vector2(-w / 2, h / 2)
			]);
			const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
			geometry.translate(0, 0, -d / 2);
			return at(
				vector([p.position[0] + w / 2, p.position[1] + d / 2, p.position[2] + h / 2]),
				geometry
			);
		}
		case 'arch':
		case 'vault':
		case 'halfpipe': {
			const w = p.width / 2,
				shape = new THREE.Shape();
			if (p.kind === 'arch') {
				const t = Math.min(p.thickness ?? w * 0.25, w * 0.6),
					r = w - t,
					spring = Math.max(0, p.rise - t - r);
				shape.moveTo(-w, 0);
				shape.lineTo(-r, 0);
				shape.lineTo(-r, spring);
				shape.absarc(0, spring, r, Math.PI, 0, true);
				shape.lineTo(r, 0);
				shape.lineTo(w, 0);
				shape.lineTo(w, Math.max(p.rise, spring + r + 0.05));
				shape.lineTo(-w, Math.max(p.rise, spring + r + 0.05));
			} else {
				const up = p.kind === 'vault',
					cy = up ? 0 : p.rise,
					t = p.thickness ?? (up ? 0 : Math.min(0.5, w * 0.2));
				const [a0, a1] = up ? [0, Math.PI] : [Math.PI, Math.PI * 2];
				shape.absellipse(0, cy, w, p.rise, a0, a1, false, 0);
				if (t > 0) shape.absellipse(0, cy, w - t, p.rise - t, a1, a0, true, 0);
			}
			const geometry = new THREE.ExtrudeGeometry(shape, {
				depth: p.length,
				bevelEnabled: false,
				curveSegments: 32
			});
			geometry.translate(0, 0, -p.length / 2);
			// Profile spans local x; length runs along local y (three −z).
			return at(vector(p.position), geometry, {
				outline: p.kind === 'vault' && !p.thickness
			});
		}
		case 'frame': {
			const [sx, sy, sz] = p.size,
				[nx, ny, nz] = p.cells.map((n) => Math.max(1, Math.round(n)));
			const bars: THREE.BufferGeometry[] = [];
			const z = new THREE.Vector3(0, 0, 1);
			const rulings: number[] = [];
			const bar = (a: Vec3, b: Vec3, thin = 1) => {
				const va = vector(a),
					vb = vector(b);
				rulings.push(...va.toArray(), ...vb.toArray());
				const dir = vb.clone().sub(va),
					len = dir.length();
				const g = new THREE.BoxGeometry(p.bar * thin, p.bar * thin, len);
				g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(z, dir.normalize()));
				g.translate(...va.add(vb).multiplyScalar(0.5).toArray());
				bars.push(g);
			};
			if (p.members) {
				for (const [a, b] of p.members) bar(a, b);
				const geometry = mergeGeometries(bars);
				for (const g of bars) g.dispose();
				return at(new THREE.Vector3(), geometry, { rotation: 0, edges: false, rulings });
			}
			const X = (i: number) => -sx / 2 + (sx * i) / nx,
				Y = (j: number) => -sy / 2 + (sy * j) / ny,
				Z = (k: number) => -sz / 2 + (sz * k) / nz,
				h = p.bar / 2;
			for (let i = 0; i <= nx; i++)
				for (let j = 0; j <= ny; j++) bar([X(i), Y(j), -sz / 2], [X(i), Y(j), sz / 2]);
			for (let k = 0; k <= nz; k++) {
				for (let j = 0; j <= ny; j++) bar([-sx / 2 - h, Y(j), Z(k)], [sx / 2 + h, Y(j), Z(k)], 0.8);
				for (let i = 0; i <= nx; i++) bar([X(i), -sy / 2 - h, Z(k)], [X(i), sy / 2 + h, Z(k)], 0.8);
			}
			if (p.braced)
				for (let k = 0; k < nz; k++)
					for (let i = 0; i < nx; i++)
						for (const y of [-sy / 2, sy / 2])
							bar([X(i + ((i + k) % 2)), y, Z(k)], [X(i + 1 - ((i + k) % 2)), y, Z(k + 1)], 0.55);
			const geometry = mergeGeometries(bars);
			for (const g of bars) g.dispose();
			return at(
				vector([p.position[0] + sx / 2, p.position[1] + sy / 2, p.position[2] + sz / 2]),
				geometry,
				{ edges: false, rulings }
			);
		}
		case 'torus': {
			const arc = p.arc ?? Math.PI * 2;
			const geometry = new THREE.TorusGeometry(
				p.radius,
				p.tube,
				round(p.tube),
				Math.max(4, Math.ceil((round(p.radius) * arc) / (Math.PI * 2))),
				arc
			);
			if (p.axis === 'z') geometry.rotateX(-Math.PI / 2);
			return at(vector(p.position), geometry, { outline: true });
		}
		case 'helix': {
			const steps = Math.max(12, Math.round(p.turns * seg(64))),
				positions: number[] = [],
				index: number[] = [];
			// Four strips (top, bottom, outer, inner), each with own vertices → hard edges.
			const strip = (ra: number, za: number, rb: number, zb: number) => {
				const base = positions.length / 3;
				for (let i = 0; i <= steps; i++) {
					const a = (i / steps) * p.turns * Math.PI * 2,
						z = (i / steps) * (p.height - p.thickness);
					for (const [r, dz] of [
						[ra, za],
						[rb, zb]
					])
						positions.push(r * Math.cos(a), z + dz, -r * Math.sin(a));
				}
				for (let i = 0; i < steps; i++) {
					const q = base + i * 2;
					index.push(q, q + 2, q + 1, q + 1, q + 2, q + 3);
				}
			};
			const ri = p.innerRadius,
				ro = p.radius,
				t = p.thickness;
			strip(ri, t, ro, t);
			strip(ro, 0, ri, 0);
			strip(ro, t, ro, 0);
			strip(ri, 0, ri, t);
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
			geometry.setAttribute(
				'uv',
				new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2)
			);
			geometry.setIndex(index);
			geometry.computeVertexNormals();
			return at(vector(p.position), geometry, { double: true });
		}
		case 'membrane': {
			const [a, b, c, d] = p.corners.map(vector),
				n = 16,
				sag = p.sag ?? 0,
				positions: number[] = [],
				index: number[] = [],
				rulings: number[] = [];
			const point = (u: number, v: number) =>
				a
					.clone()
					.multiplyScalar((1 - u) * (1 - v))
					.add(b.clone().multiplyScalar(u * (1 - v)))
					.add(c.clone().multiplyScalar(u * v))
					.add(d.clone().multiplyScalar((1 - u) * v))
					.add(new THREE.Vector3(0, -sag * 16 * u * (1 - u) * v * (1 - v), 0));
			for (let j = 0; j <= n; j++)
				for (let i = 0; i <= n; i++) positions.push(...point(i / n, j / n).toArray());
			for (let j = 0; j < n; j++)
				for (let i = 0; i < n; i++) {
					const q = j * (n + 1) + i;
					index.push(q, q + 1, q + n + 1, q + 1, q + n + 2, q + n + 1);
				}
			for (let k = 1; k < 4; k++)
				for (let i = 0; i < n; i++) {
					rulings.push(...point(k / 4, i / n).toArray(), ...point(k / 4, (i + 1) / n).toArray());
					rulings.push(...point(i / n, k / 4).toArray(), ...point((i + 1) / n, k / 4).toArray());
				}
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
			geometry.setAttribute(
				'uv',
				new THREE.Float32BufferAttribute(new Array((positions.length / 3) * 2).fill(0), 2)
			);
			geometry.setIndex(index);
			geometry.computeVertexNormals();
			return at(new THREE.Vector3(), geometry, { double: true, rotation: 0, rulings });
		}
	}
}

/** One scene per canvas. Geometry updates never allocate another WebGL context. */
export function createParametrikScene(
	canvas: HTMLCanvasElement,
	palette: Palette3D,
	onError: () => void,
	interactive = true
) {
	const renderer = new THREE.WebGPURenderer({
		canvas,
		antialias: true,
		alpha: false
	});
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.NoToneMapping;
	renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
	const materials = new Map<string, THREE.Material>();
	const usedMaterials = new Set<string>();
	const painters: (() => void)[] = [];
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(palette.paper);
	const camera = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 2000);
	const model = new THREE.Group();
	scene.add(model);
	let alive = true,
		width = 1,
		height = 1,
		fixed: View | undefined;
	let initialized = false;
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
	const render = () => {
		if (alive && initialized) {
			renderer.render(scene, camera);
			canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
		}
	};
	const controls = interactive ? new OrbitControls(camera, canvas) : undefined;
	let moved = false,
		fitting = false;
	controls?.addEventListener('change', () => {
		if (!fitting) moved = true;
		render();
	});
	if (controls) {
		controls.minZoom = 0.1;
		controls.maxZoom = 12;
		controls.listenToKeyEvents(canvas);
	}
	function clear() {
		painters.length = 0;
		model.traverse((object) => {
			if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
				object.geometry.dispose();
			}
		});
		model.clear();
	}
	function fit(reset = false) {
		if (moved && !reset) {
			camera.left = (-camera.top * width) / height;
			camera.right = -camera.left;
			camera.updateProjectionMatrix();
			render();
			return;
		}
		const bounds = new THREE.Box3().setFromObject(model);
		if (bounds.isEmpty() && !fixed) return;
		const center = fixed ? vector(fixed.center) : bounds.getCenter(new THREE.Vector3());
		const eye = fixed?.eye
			? vector(fixed.eye).normalize()
			: new THREE.Vector3(-Math.sqrt(3 / 8), 0.5, Math.sqrt(3 / 8));
		camera.up.set(0, 1, 0);
		if (Math.abs(eye.y) > 0.99) camera.up.set(0, 0, -1);
		camera.position.copy(center).add(eye.multiplyScalar(500));
		camera.lookAt(center);
		controls?.target.copy(center);
		fitting = true;
		controls?.update();
		fitting = false;
		camera.updateMatrixWorld(true);
		const projected = new THREE.Box3();
		model.updateMatrixWorld(true);
		const point = new THREE.Vector3();
		model.traverse((o) => {
			if (!(o instanceof THREE.Mesh) || o instanceof LineSegments2) return;
			const positions = o.geometry.getAttribute('position');
			for (let i = 0; i < positions.count; i++)
				projected.expandByPoint(
					point
						.fromBufferAttribute(positions, i)
						.applyMatrix4(o.matrixWorld)
						.applyMatrix4(camera.matrixWorldInverse)
				);
		});
		const span = fixed
			? fixed.span
			: Math.max(
					Math.abs(projected.min.y),
					Math.abs(projected.max.y),
					Math.abs(projected.min.x) / (width / height),
					Math.abs(projected.max.x) / (width / height)
				) * 1.12;
		camera.left = -(span * width) / height;
		camera.right = (span * width) / height;
		camera.top = span;
		camera.bottom = -span;
		camera.updateProjectionMatrix();

		render();
	}
	let parent: THREE.Object3D = model;
	const signal = new THREE.Color(palette.categories['--signal'] || palette.ink);
	const groups = new Map<string, THREE.Group>();
	const pickables: THREE.Mesh[] = [];
	let offsets = new Map<string, Vec3>();
	function applyOffsets() {
		for (const [key, group] of groups) {
			const o = offsets.get(key);
			if (o) group.position.copy(vector(o));
			else group.position.set(0, 0, 0);
		}
	}
	function inkColor(existing: boolean) {
		return new THREE.Color(palette.ink)
			.convertLinearToSRGB()
			.lerp(new THREE.Color(palette.paper).convertLinearToSRGB(), existing ? 0.62 : 0)
			.convertSRGBToLinear();
	}
	/** Material factories read the current palette; repainting never touches geometry. */
	function paintedMesh(geometry: THREE.BufferGeometry, material: () => THREE.Material) {
		const mesh = new THREE.Mesh(geometry, material());
		painters.push(() => {
			mesh.material = material();
		});
		return mesh;
	}
	function segments(
		positions: number[],
		place: THREE.Object3D,
		existing: boolean,
		weight = 1,
		color = () => inkColor(existing)
	) {
		const paint = () => {
			const nextColor = color();
			const key = `line-${nextColor.getHexString()}-${existing}-${weight}`;
			usedMaterials.add(key);
			let material = materials.get(key) as THREE.Line2NodeMaterial | undefined;
			if (!material) {
				material = new THREE.Line2NodeMaterial({
					color: nextColor,
					linewidth: (existing ? 0.9 : 1.1) * weight
				});
				materials.set(key, material);
			}
			return material;
		};
		const line = new LineSegments2(new LineSegmentsGeometry().setPositions(positions), paint());
		painters.push(() => {
			line.material = paint();
		});
		line.position.copy(place.position);
		line.rotation.copy(place.rotation);
		parent.add(line);
	}
	function update(
		primitives: Primitive[],
		style: SceneStyle = defaultStyle,
		view?: View,
		groupOf?: GroupOf
	) {
		if (!alive) return;
		clear();
		groups.clear();
		pickables.length = 0;
		usedMaterials.clear();
		fixed = view;
		const groupFor = (key: string) => {
			let g = groups.get(key);
			if (!g) {
				g = new THREE.Group();
				groups.set(key, g);
				model.add(g);
			}
			return g;
		};
		// Polylines are batched per role (and group): one draw call each instead of one per line.
		const plan = new Map<
			string,
			{
				group: string;
				role: 'neu' | 'bestand';
				strong?: Primitive['emphasis'];
				positions: number[];
			}
		>();
		for (const p of primitives) {
			const group = groupOf?.(p) ?? '';
			parent = groupOf ? groupFor(group) : model;
			if (p.kind === 'polyline') {
				const key = `${group}\u0000${p.role}\u0000${p.emphasis ?? ''}`;
				const batch = plan.get(key) ?? {
					group,
					role: p.role,
					strong: p.emphasis,
					positions: []
				};
				plan.set(key, batch);
				const pts = p.closed ? [...p.points, p.points[0]] : p.points;
				for (let i = 1; i < pts.length; i++)
					batch.positions.push(...vector(pts[i - 1]).toArray(), ...vector(pts[i]).toArray());
				continue;
			}
			const built = build(p);
			const { geometry } = built;
			const place = new THREE.Object3D();
			place.position.copy(built.position);
			place.rotation.y = built.rotation;
			// Patterns need no UV: they lie on the drawing sheet (schraffur.ts), seamless on curves.
			const surfaceTone = () => {
				const category = p.token.replace('--cat-', '');
				const base =
					p.token === '--paper'
						? palette.paper
						: p.token === '--blueprint'
							? palette.blueprint
							: palette.categories[category];
				const color =
					p.role === 'bestand'
						? new THREE.Color(palette.paper)
								.convertLinearToSRGB()
								.lerp(new THREE.Color(palette.ink).convertLinearToSRGB(), p.shade ?? 0.06)
								.convertSRGBToLinear()
						: new THREE.Color(base ?? palette.paper)
								.convertLinearToSRGB()
								.lerp(new THREE.Color(palette.paper).convertLinearToSRGB(), style.memphis ? 0 : 0.5)
								.convertSRGBToLinear();
				if (style.memphis && p.pattern) color.set(palette.paper);
				if (p.role === 'neu' && p.shade)
					color
						.convertLinearToSRGB()
						.lerp(new THREE.Color(palette.ink).convertLinearToSRGB(), p.shade)
						.convertSRGBToLinear();
				return color;
			};
			if (p.section) {
				const section = p.section;
				// Cut face (poché): new in ink, existing stock hatched gray; edge in ink.
				const mesh = paintedMesh(geometry, () => {
					const key = `section-${section}`;
					usedMaterials.add(key);
					let material = materials.get(key) as THREE.MeshBasicNodeMaterial | undefined;
					if (!material) {
						material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
						material.colorNode = pocheColor(
							section,
							new THREE.Color(palette.paper),
							inkColor(false),
							inkColor(true)
						);
						materials.set(key, material);
					}
					return material;
				});
				mesh.position.copy(place.position);
				mesh.rotation.copy(place.rotation);
				mesh.userData.id = p.id;
				pickables.push(mesh);
				parent.add(mesh);
				const edges = new THREE.EdgesGeometry(geometry, built.edgeAngle);
				const chosen = p.emphasis === 'auswahl';
				segments(
					Array.from(edges.getAttribute('position').array),
					place,
					false,
					chosen ? 2.6 : 0.9,
					() => (chosen ? signal : inkColor(false))
				);
				edges.dispose();
				continue;
			}
			const see = style.level === 'hull' || !!p.glass;
			// Materialsystem (data/material.ts): only on opt-in or for the new material ids.
			const look =
				style.level !== 'hull' && usesMaterialSystem(p.material, style.materials)
					? (({ material, token }) => materialLook(material, token))(resolveMaterial(p))
					: undefined;
			if (p.kind === 'frame' && built.rulings) {
				// Stabwerk as drawing: paper bars in ink, coloured bars as a broad coloured stroke.
				const plain = p.token === '--paper' || p.role === 'bestand';
				if (!plain)
					segments(built.rulings, place, false, 2.6, () =>
						look ? lookColor(look, palette) : surfaceTone()
					);
				segments(built.rulings, place, p.role === 'bestand', plain ? 0.9 : 0.45);
				// Invisible proxy keeps the bars in the camera fit.
				const proxy = new THREE.Mesh(
					geometry,
					(materials.get('proxy') ?? new THREE.MeshBasicMaterial()) as THREE.Material
				);
				materials.set('proxy', proxy.material);
				usedMaterials.add('proxy');
				proxy.visible = false;
				proxy.position.copy(place.position);
				proxy.rotation.copy(place.rotation);
				proxy.userData.id = p.id;
				pickables.push(proxy);
				parent.add(proxy);
				continue;
			}
			if (look) {
				const mesh = paintedMesh(geometry, () => {
					const key = `finish-${look.material}-${look.token}-${!!built.double}`;
					usedMaterials.add(key);
					let material = materials.get(key);
					if (!material) {
						material = finishMaterial(look, palette, !!built.double);
						materials.set(key, material);
					}
					return material;
				});
				mesh.position.copy(place.position);
				mesh.rotation.copy(place.rotation);
				mesh.renderOrder = look.renderOrder;
				mesh.userData.id = p.id;
				pickables.push(mesh);
				parent.add(mesh);
			} else {
				const mesh = paintedMesh(geometry, () => {
					const color = surfaceTone();
					const key = `surface-${color.getHexString()}-${see}-${p.glass}-${built.double}-${p.role}-${style.level}-${style.material}-${p.material}-${style.memphis ? p.pattern : ''}`;
					usedMaterials.add(key);
					let material = materials.get(key) as THREE.MeshBasicNodeMaterial | undefined;
					if (!material) {
						material = new THREE.MeshBasicNodeMaterial({
							transparent: see,
							opacity: see ? (p.glass && style.level !== 'hull' ? 0.22 : 0.12) : 1,
							depthWrite: !see,
							side: built.double || p.glass ? THREE.DoubleSide : THREE.FrontSide,
							polygonOffset: true,
							polygonOffsetFactor: 1,
							polygonOffsetUnits: 1
						});
						material.colorNode = surfaceColor(
							color,
							p.material,
							p.role === 'bestand' || p.glass ? 'flat' : style.material,
							style.memphis ? p.pattern : undefined,
							inkColor(false)
						);
						materials.set(key, material);
					}
					return material;
				});
				mesh.position.copy(place.position);
				mesh.rotation.copy(place.rotation);
				mesh.userData.id = p.id;
				pickables.push(mesh);
				parent.add(mesh);
			}
			const existing = p.role === 'bestand';
			// Material edge: ink toward paper and relative width; existing stock in white architectural model keeps its gray line.
			const edge = look && !(existing && look.material === 'paper') ? look.edge : undefined;
			const drawEdges = !look || look.edge !== null;
			if ((style.lines || style.level === 'hull') && drawEdges) {
				if (built.edges !== false && p.edges !== false) {
					const edges = new THREE.EdgesGeometry(geometry, built.edgeAngle);
					const positions = Array.from(edges.getAttribute('position').array);
					const strong = p.emphasis ? 2.6 : 1;
					if (p.emphasis === 'auswahl') segments(positions, place, false, strong, () => signal);
					else if (edge && look)
						segments(positions, place, existing, edge.width * strong, () =>
							edgeColor(look, palette)
						);
					else segments(positions, place, existing, strong);
					edges.dispose();
				}
				if (built.rulings)
					segments(built.rulings, place, existing, built.edges === false ? 0.8 : 0.6);
				// Inverted hull: screen-space normal extrusion, only on curved primitives.
				if (built.outline && !see && !look?.transparent) {
					const hull = paintedMesh(geometry.clone(), () => {
						const outlineKey = `outline-${existing}`;
						usedMaterials.add(outlineKey);
						let outline = materials.get(outlineKey) as THREE.MeshBasicNodeMaterial | undefined;
						if (!outline) {
							outline = new THREE.MeshBasicNodeMaterial({
								side: THREE.BackSide,
								color: inkColor(existing)
							});
							outline.vertexNode = outlinePosition(existing ? 0.9 : 1.1);
							materials.set(outlineKey, outline);
						}
						return outline;
					});
					hull.position.copy(place.position);
					hull.rotation.copy(place.rotation);
					parent.add(hull);
				}
			}
			if (p.kind === 'box' && p.floors)
				for (const z of p.floors) {
					const g = new THREE.PlaneGeometry(p.size[0], p.size[1]).rotateX(-Math.PI / 2);
					const edges = new THREE.EdgesGeometry(g, 46);
					const floor = new THREE.Object3D();
					floor.position.set(place.position.x, z, place.position.z);
					floor.rotation.copy(place.rotation);
					segments(Array.from(edges.getAttribute('position').array), floor, existing);
					edges.dispose();
					g.dispose();
				}
		}
		for (const batch of plan.values()) {
			parent = groupOf ? groupFor(batch.group) : model;
			segments(
				batch.positions,
				new THREE.Object3D(),
				batch.role === 'bestand',
				batch.strong ? 2.6 : 1,
				() => (batch.strong === 'auswahl' ? signal : inkColor(batch.role === 'bestand'))
			);
		}
		parent = model;
		applyOffsets();
		for (const [key, material] of materials)
			if (!usedMaterials.has(key)) {
				material.dispose();
				materials.delete(key);
			}
		fit();
	}
	const stopTheme = bindSceneTheme(canvas, scene, renderer, (next) => {
		palette = next;
		signal.set(next.categories['--signal'] || next.ink);
		// The invisible proxy is palette-independent and keeps its material identity.
		for (const [key, material] of materials)
			if (key !== 'proxy') {
				material.dispose();
				materials.delete(key);
			}
		usedMaterials.clear();
		if (materials.has('proxy')) usedMaterials.add('proxy');
		for (const paint of painters) paint();
		render();
	});
	const raycaster = new THREE.Raycaster();
	return {
		update,
		ready,
		camera,
		/** New fixed framing without rebuilding geometry (explosion zooms out smoothly). */
		frame(view: View) {
			fixed = view;
			fit();
		},
		/** Moves groups (see update groupOf) without rebuilding geometry; metres in world x/y/z. */
		arrange(next: Map<string, Vec3>) {
			offsets = next;
			applyOffsets();
			render();
		},
		/** Primitive id under a point in normalised device coordinates (−1 … 1). */
		pick(x: number, y: number): string | undefined {
			raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
			model.updateMatrixWorld(true);
			return raycaster.intersectObjects(pickables, false)[0]?.object.userData.id as
				string | undefined;
		},
		cameraState: () => ({
			position: camera.position.clone(),
			target: controls?.target.clone(),
			zoom: camera.zoom,
			top: camera.top,
			moved
		}),
		restoreCamera(state: {
			position: THREE.Vector3;
			target?: THREE.Vector3;
			zoom: number;
			top: number;
			moved: boolean;
		}) {
			camera.position.copy(state.position);
			camera.zoom = state.zoom;
			camera.top = state.top;
			camera.bottom = -state.top;
			if (state.target) {
				controls?.target.copy(state.target);
				camera.lookAt(state.target);
			}
			fitting = true;
			controls?.update();
			fitting = false;
			moved = state.moved;
		},
		reset() {
			moved = false;
			camera.zoom = 1;
			fit(true);
		},
		/** PNG of the last frame (preserveDrawingBuffer). */
		snapshot: () => canvas.toDataURL('image/png'),
		resize(w: number, h: number) {
			width = Math.max(w, 1);
			height = Math.max(h, 1);
			renderer.setSize(width, height, false);
			fit();
		},
		dispose() {
			if (!alive) return;
			stopTheme();
			alive = false;
			clear();
			controls?.dispose();
			for (const material of materials.values()) material.dispose();
			materials.clear();
			if (initialized) renderer.dispose();
		}
	};
}
