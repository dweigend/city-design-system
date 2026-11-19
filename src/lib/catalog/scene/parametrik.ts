import { studioGround } from './studio-ground';
import { studioShadow } from './studio-shadow';
import { studioPipeline } from './studio-pipeline';
import { color as colorNode } from 'three/tsl';
import { pencilStock } from './pencil-stock';
import {
	createDrawingRenderer,
	initializeDrawingRenderer,
	resizeDrawingRenderer
} from './drawing-renderer';
import { chartSurface } from './surface-chart';
import { resolveFinish, drawingSurface } from '../logic/material/surface';
import { createMaterialLibrary } from './material-library';
import {
	glazeContourMaterial,
	hasGlazeContour,
	silhouette,
	type GlazeContour
} from './sandbox/structure-outline';
import { sceneSwatch } from './scene-palette';
import { bindSceneTheme } from './themeBinding';
import { legacyRoleOf } from '../logic/parametrik/types';
import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { surfaceColor, outlinePosition } from './surfaces';
import { edgeColor, lookColor } from './material';
import { pocheColor } from './schnitt';
import { materialLook, resolveMaterial, usesMaterialSystem } from '../logic/parametrik/material';
import { build, vector } from './primitive-geometry';
export { build } from './primitive-geometry';
import type { Palette3D } from '../data/city3d';
import type { Primitive, Vec3 } from '../logic/parametrik/types';
import { defaultStyle, type SceneStyle } from '../logic/parametrik/style';

/**
 * Fixed framing (same camera for every vignette): look at centre, half height span in metres.
 * eye: world direction toward the camera (default isometric); straight down keeps north up.
 */
export type View = { center: Vec3; span: number; eye?: Vec3 };
/** Optional grouping for the view layer: groups move as a whole (explosion, build phases). */
export type GroupOf = (p: Primitive) => string;
/** One scene per canvas. Geometry updates never allocate another WebGL context. */
export function createParametrikScene(
	canvas: HTMLCanvasElement,
	palette: Palette3D,
	onError: () => void,
	interactive = true
) {
	const renderer = createDrawingRenderer(canvas);
	const materials = new Map<string, THREE.Material>();
	const glazeContour: GlazeContour = { ink: new THREE.Color(palette.ink) };
	const usedMaterials = new Set<string>();
	const usedSurfaces = new Set<THREE.Material>();
	const painters: (() => void)[] = [];
	const scene = new THREE.Scene();
	const surfaces = createMaterialLibrary(palette, () => scene.environment);
	scene.background = new THREE.Color(palette.paper);
	const camera = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 2000);
	const pipeline = studioPipeline(renderer, scene, camera);
	const light = pipeline.light;
	const ground = studioGround(pipeline.light);
	scene.add(ground.floor);
	const model = new THREE.Group();
	scene.add(model);
	let alive = true,
		width = 1,
		height = 1,
		fixed: View | undefined;
	let initialized = false;
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
	const render = () => {
		if (alive && initialized) {
			pipeline.render();
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
	function fit(reset = false, direction?: Vec3) {
		const bounds = new THREE.Box3().setFromObject(model);
		ground.frame(bounds);
		if (moved && !reset) {
			camera.left = (-camera.top * width) / height;
			camera.right = -camera.left;
			camera.updateProjectionMatrix();
			render();
			return;
		}
		if (bounds.isEmpty() && !fixed) return;
		const center = fixed ? vector(fixed.center) : bounds.getCenter(new THREE.Vector3());
		light.aim(center, Math.max(3, bounds.getSize(new THREE.Vector3()).length()));
		const eyeDirection = direction ?? fixed?.eye;
		const eye = eyeDirection
			? vector(eyeDirection).normalize()
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
		// Batched drawings include screen-space lines and instances. Their world bounds cover both.
		const projected = direction
			? bounds.clone().applyMatrix4(camera.matrixWorldInverse)
			: new THREE.Box3();
		model.updateMatrixWorld(true);
		const point = new THREE.Vector3();
		if (!direction)
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
	const signal = new THREE.Color(sceneSwatch(palette, '--signal'));
	const selection: GlazeContour = { ink: signal };
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
		light.refresh();
		groups.clear();
		pickables.length = 0;
		usedMaterials.clear();
		usedSurfaces.clear();
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
			const role = p.planned ? 'bestand' : legacyRoleOf(p);
			const group = groupOf?.(p) ?? '';
			parent = groupOf ? groupFor(group) : model;
			if (p.kind === 'polyline') {
				const key = `${group}\u0000${role}\u0000${p.emphasis ?? ''}`;
				const batch = plan.get(key) ?? {
					group,
					role,
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
				const base = sceneSwatch(palette, p.token);
				const color =
					role === 'bestand'
						? new THREE.Color(palette.paper)
								.convertLinearToSRGB()
								.lerp(new THREE.Color(palette.ink).convertLinearToSRGB(), p.shade ?? 0.06)
								.convertSRGBToLinear()
						: new THREE.Color(base)
								.convertLinearToSRGB()
								.lerp(new THREE.Color(palette.paper).convertLinearToSRGB(), style.memphis ? 0 : 0.5)
								.convertSRGBToLinear();
				if (style.memphis && p.pattern) color.set(palette.paper);
				if (role === 'neu' && p.shade)
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
				(role === 'neu' || p.material === 'ghost') &&
				style.level !== 'hull' &&
				usesMaterialSystem(p.material, style.materials)
					? (({ material, token }) => materialLook(material, token))(resolveMaterial(p))
					: undefined;
			const finish = style.level !== 'hull' && role === 'neu' ? p.finish : undefined;
			if (!finish && p.kind === 'frame' && built.rulings) {
				// Stabwerk as drawing: paper bars in ink, coloured bars as a broad coloured stroke.
				const plain = p.token === '--paper' || role === 'bestand';
				if (!plain)
					segments(built.rulings, place, false, 2.6, () =>
						look ? lookColor(look, palette) : surfaceTone()
					);
				segments(built.rulings, place, role === 'bestand', plain ? 0.9 : 0.45);
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
			const surface = finish
				? resolveFinish(finish, p.token, p.ageTint)
				: look
					? drawingSurface(look)
					: undefined;
			if (surface) {
				if (finish) chartSurface(geometry, p.kind);
				const mesh = paintedMesh(geometry, () => {
					const material = surfaces.material(surface, !!built.double);
					usedSurfaces.add(material);
					return material;
				});
				mesh.position.copy(place.position);
				mesh.rotation.copy(place.rotation);
				studioShadow(mesh, mesh.material);
				mesh.renderOrder = look?.renderOrder ?? 1;
				mesh.userData.id = p.id;
				pickables.push(mesh);
				parent.add(mesh);
			} else {
				const mesh = paintedMesh(geometry, () => {
					const color = surfaceTone();
					const key = `surface-${color.getHexString()}-${see}-${p.glass}-${built.double}-${role}-${style.level}-${style.material}-${p.material}-${style.memphis ? p.pattern : ''}`;
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
						material.colorNode =
							role === 'bestand' && !see
								? pencilStock(colorNode(color).rgb, colorNode(inkColor(true)).rgb)
								: surfaceColor(
										color,
										p.material,
										role === 'bestand' || p.glass ? 'flat' : style.material,
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
			const existing = role === 'bestand';
			// Material edge: ink toward paper and relative width; existing stock in white architectural model keeps its gray line.
			const edge = look && !(existing && look.material === 'paper') ? look.edge : undefined;
			const drawEdges = !look || look.edge !== null;
			if ((style.lines || style.level === 'hull') && drawEdges) {
				if (!finish && built.edges !== false && p.edges !== false) {
					const edges = new THREE.EdgesGeometry(geometry, built.edgeAngle);
					const positions = Array.from(edges.getAttribute('position').array);
					const strong = p.emphasis ? 2.6 : 1;
					if (p.emphasis === 'auswahl') segments(positions, place, false, strong, () => signal);
					else if (edge && look)
						segments(positions, place, existing, edge.width * strong, () =>
							edgeColor(edge.paper, palette)
						);
					else segments(positions, place, existing, strong);
					edges.dispose();
				}
				if (!finish && built.rulings)
					segments(built.rulings, place, existing, built.edges === false ? 0.8 : 0.6);
				// Glazed bodies use the shared screen-space silhouette.
				const selected = !!finish && p.emphasis === 'auswahl';
				if ((selected || hasGlazeContour(finish)) && !see) {
					const hull = silhouette(
						geometry,
						glazeContourMaterial(selected ? selection : glazeContour)
					);
					hull.position.copy(place.position);
					hull.rotation.copy(place.rotation);
					parent.add(hull);
				} else if (!finish && built.outline && !see && !look?.transparent) {
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
		surfaces.retain(usedSurfaces);
		for (const [key, material] of materials)
			if (!usedMaterials.has(key)) {
				material.dispose();
				materials.delete(key);
			}
		fit();
	}
	const stopTheme = bindSceneTheme(canvas, scene, renderer, (next) => {
		palette = next;
		surfaces.setPalette(next);
		glazeContour.ink.set(next.ink);
		signal.set(sceneSwatch(next, '--signal'));
		// The invisible proxy is palette-independent and keeps its material identity.
		for (const [key, material] of materials)
			if (key !== 'proxy') {
				material.dispose();
				materials.delete(key);
			}
		usedMaterials.clear();
		usedSurfaces.clear();
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
			light.refresh();
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
		/** Encodes one caller-owned drawing as a PNG before the stage can be reused. Eye is a world direction. */
		async snapshotDrawing(drawing: THREE.Group, eye: Vec3): Promise<Blob> {
			light.refresh();
			model.add(drawing);
			try {
				fit(true, eye);
				return await new Promise<Blob>((resolve, reject) => {
					canvas.toBlob((png) => {
						if (png) resolve(png);
						else reject(new Error('The canvas could not encode this drawing.'));
					}, 'image/png');
				});
			} finally {
				model.remove(drawing);
			}
		},
		/** PNG of the last frame (preserveDrawingBuffer). */
		snapshot: () => canvas.toDataURL('image/png'),
		resize(w: number, h: number) {
			[width, height] = resizeDrawingRenderer(renderer, w, h);
			fit();
		},
		async dispose() {
			if (!alive) return;
			stopTheme();
			alive = false;
			clear();
			glazeContour.material?.dispose();
			selection.material?.dispose();
			controls?.dispose();
			for (const material of materials.values()) material.dispose();
			materials.clear();
			surfaces.dispose();
			ground.dispose();
			pipeline.dispose();
			if (initialized) await renderer.dispose();
		}
	};
}
