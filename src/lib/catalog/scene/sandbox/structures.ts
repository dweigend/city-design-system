/**
 * Everything the player builds, drawn from the shared render contract: keyed groups of
 * primitives (a house chunk, a forest chunk, a transit line) become a few merged meshes each.
 * Replacing one key rebuilds only that group.
 */
import * as THREE from 'three/webgpu';
import { attribute, uniform } from 'three/tsl';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Palette3D } from '../../data/city3d';
import type { Primitive } from '../../logic/parametrik/types';
import { batch, geometryOf } from '../batch';
import { outlinePosition } from '../surfaces';

const STROKE_PX = { crease: 0.8, outline: 1 };
/**
 * Lines keep their weight only while the model is large enough to carry them: the outline is
 * never wider than this many meters, and creases fade below this many pixels per meter.
 */
const LINE_SCALE = { outlineMeters: 0.09, creaseFullAt: 7, creaseFloor: 0.22 };
const GLASS_OPACITY = 0.34;

export type Structures = ReturnType<typeof createStructures>;

/** Creates the structure layer. The caller adds `group` to its scene and calls `dispose`. */
export function createStructures() {
	const group = new THREE.Group();
	const entries = new Map<string, { primitives: Primitive[]; objects: THREE.Group }>();
	const paper = new THREE.Color();
	const ink = new THREE.Color();
	const blueprint = new THREE.Color();
	let categories: Record<string, THREE.Color> = {};

	const surface = (more: THREE.MeshLambertNodeMaterialParameters = {}) => {
		const material = new THREE.MeshLambertNodeMaterial({
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1,
			...more
		});
		material.colorNode = attribute('color', 'vec3');
		return material;
	};
	const materials = {
		solid: surface(),
		stock: new THREE.MeshBasicNodeMaterial({
			color: paper,
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		}),
		pencilHull: new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide }),
		pencil: new THREE.Line2NodeMaterial({ linewidth: 0.65 }),
		ghostEdge: new THREE.Line2NodeMaterial({ linewidth: 0.4, transparent: true, opacity: 0.22 }),
		ghost: new THREE.MeshBasicNodeMaterial({
			transparent: true,
			opacity: 0.16,
			depthWrite: false,
			side: THREE.DoubleSide
		}),
		sheet: surface({ side: THREE.DoubleSide }),
		glass: surface({
			transparent: true,
			opacity: GLASS_OPACITY,
			depthWrite: false,
			side: THREE.DoubleSide
		}),
		hull: new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, color: ink }),
		crease: new THREE.Line2NodeMaterial({ color: ink, linewidth: STROKE_PX.crease })
	};
	const outlinePx = uniform(STROKE_PX.outline);
	materials.pencilHull.vertexNode = outlinePosition(uniform(0.5));
	materials.hull.vertexNode = outlinePosition(outlinePx);
	materials.crease.transparent = true;

	function tokenColor(token: Primitive['token']): THREE.Color {
		if (token === '--paper') return paper;
		if (token === '--blueprint') return blueprint;
		return categories[token.replace('--cat-', '')] ?? paper;
	}

	function colorOf(p: Primitive): THREE.Color {
		const base = tokenColor(p.token);
		return p.shade ? base.clone().lerp(ink, p.shade) : base;
	}

	function build(primitives: Primitive[]): THREE.Group {
		const objects = new THREE.Group();
		const parts = batch(
			primitives.filter((p) => p.material !== 'ghost'),
			colorOf
		);
		const mesh = (faces: typeof parts.neu, material: THREE.Material, shadow: boolean) => {
			if (!faces.p.length) return undefined;
			const object = new THREE.Mesh(geometryOf(faces), material);
			object.castShadow = object.receiveShadow = shadow;
			objects.add(object);
			return object;
		};
		const hits = [mesh(parts.neu, materials.solid, true), mesh(parts.alt, materials.stock, false)];
		mesh(parts.hull.alt, materials.pencilHull, false);
		const ghosts = batch(
			primitives.filter((p) => p.material === 'ghost'),
			colorOf
		);
		for (const faces of [ghosts.alt, ghosts.blatt, ghosts.neu, ghosts.glas])
			hits.push(mesh(faces, materials.ghost, false));
		objects.userData.hits = hits.filter(Boolean);
		const lines = (segments: number[], material: THREE.Line2NodeMaterial) => {
			if (segments.length)
				objects.add(new LineSegments2(new LineSegmentsGeometry().setPositions(segments), material));
		};
		lines(parts.kanten.alt, materials.pencil);
		lines(ghosts.kanten.alt, materials.ghostEdge);
		mesh(parts.blatt, materials.sheet, true);
		// The ink silhouette is an inverted hull over every solid, not only over round parts.
		mesh(parts.neu, materials.hull, false);
		mesh(parts.glas, materials.glass, false);
		lines(parts.kanten.neu, materials.crease);
		return objects;
	}

	function release(objects: THREE.Group) {
		group.remove(objects);
		for (const object of objects.children)
			(object as THREE.Mesh | LineSegments2).geometry.dispose();
	}

	/** Replaces the primitives stored under a key; an empty list removes the key. */
	function set(key: string, primitives: Primitive[]) {
		const previous = entries.get(key);
		if (previous) release(previous.objects);
		entries.delete(key);
		if (!primitives.length) return;
		const objects = build(primitives);
		entries.set(key, { primitives, objects });
		group.add(objects);
	}

	return {
		group,
		set,
		/** Solid meshes of every key with the given prefix, for ray casting. */
		solids(prefix: string): THREE.Mesh[] {
			return [...entries]
				.filter(([key]) => key.startsWith(prefix))
				.flatMap(([, entry]) => entry.objects.userData.hits as THREE.Mesh[]);
		},
		/** Applies theme colors. Colors are baked per vertex, so every key is rebuilt once. */
		setPalette(palette: Palette3D) {
			paper.set(palette.paper);
			ink.set(palette.ink);
			blueprint.set(palette.blueprint);
			categories = Object.fromEntries(
				Object.entries(palette.categories).map(([name, value]) => [name, new THREE.Color(value)])
			);
			materials.stock.color.copy(paper);
			materials.pencil.color.copy(paper).lerp(ink, 0.52);
			materials.pencilHull.color.copy(materials.pencil.color);
			materials.ghostEdge.color.copy(materials.pencil.color);
			materials.ghost.color.copy(paper).lerp(ink, 0.28);
			materials.hull.color.copy(ink);
			materials.crease.color.copy(ink);
			for (const [key, entry] of [...entries]) set(key, entry.primitives);
		},
		/** Adapts line weights to the zoom, given in screen pixels per world meter. */
		setScale(pixelsPerMeter: number) {
			outlinePx.value = Math.min(STROKE_PX.outline, LINE_SCALE.outlineMeters * pixelsPerMeter);
			materials.crease.opacity = Math.max(
				LINE_SCALE.creaseFloor,
				Math.min(1, pixelsPerMeter / LINE_SCALE.creaseFullAt)
			);
		},
		/** Removes every key. */
		clear() {
			for (const key of [...entries.keys()]) set(key, []);
		},
		dispose() {
			for (const key of [...entries.keys()]) set(key, []);
			for (const material of Object.values(materials)) material.dispose();
		}
	};
}
