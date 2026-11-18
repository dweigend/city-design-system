import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { Primitive, Vec3 } from '../../logic/parametrik/types';
import { batch, geometryOf, type Batch } from '../batch';
import type { StructureMaterials } from './structure-materials';
import { outlineOffsets } from './structure-outline';

function memberTrace(part: Primitive): Primitive[] {
	if (part.kind === 'polyline') return [{ ...part, role: 'neu' }];
	if (part.kind === 'pipe') return [{ ...part, role: 'neu', kind: 'polyline' }];
	if (part.kind !== 'cylinder') return [];
	const [x, y, z] = part.position;
	return [
		{ ...part, role: 'neu', kind: 'polyline', points: [part.position, [x, y, z + part.height]] }
	];
}

function bearingDots(points: Vec3[], geometry: THREE.BufferGeometry, material: THREE.Material) {
	const unique = new Map(points.map((point) => [point.join('/'), point]));
	const dots = new THREE.InstancedMesh(geometry, material, unique.size);
	const matrix = new THREE.Matrix4();
	let index = 0;
	for (const [x, y, z] of unique.values()) {
		matrix.setPosition(x, z, -y);
		dots.setMatrixAt(index++, matrix);
	}
	return dots;
}

function silhouette(faces: Batch['neu'], material: THREE.Material) {
	const geometry = new THREE.InstancedBufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(faces.p, 3));
	geometry.setAttribute('outlineOffset', outlineOffsets);
	geometry.instanceCount = outlineOffsets.count;
	return new THREE.Mesh(geometry, material);
}

const isCarrier = (part: Primitive) => part.role === 'traeger' || Boolean(part.member);
const isAccent = (part: Primitive) =>
	part.role === 'neu' && !part.envelope && part.token.startsWith('--cat-');

function layerOf(part: Primitive) {
	if (part.material === 'ghost') return 'ghosts';
	if (isCarrier(part)) return 'carriers';
	return isAccent(part) ? 'accents' : 'regular';
}

function partition(primitives: Primitive[]) {
	const parts = {
		regular: [] as Primitive[],
		carriers: [] as Primitive[],
		accents: [] as Primitive[],
		ghosts: [] as Primitive[]
	};
	for (const part of primitives) {
		const layer = layerOf(part);
		parts[layer].push(part.envelope ? { ...part, role: 'neu', glass: false } : part);
	}
	return parts;
}

/** Projects one structure key into pickable surfaces and independent drafting marks. */
export function populateStructures(
	primitives: Primitive[],
	finishes: StructureMaterials,
	bearingGeometry: THREE.BufferGeometry
) {
	const { materials, colorOf, accentColor } = finishes;
	const toColor = (part: Primitive) => colorOf(part.token);
	const objects = new THREE.Group();
	const hits: THREE.Mesh[] = [];
	const mesh = (faces: Batch['neu'], material: THREE.Material, pick = false, cast = false) => {
		if (!faces.p.length) return;
		const object = new THREE.Mesh(geometryOf(faces), material);
		object.castShadow = cast;
		objects.add(object);
		if (pick) hits.push(object);
	};
	const lines = (segments: number[], material: THREE.Line2NodeMaterial) => {
		if (segments.length)
			objects.add(new LineSegments2(new LineSegmentsGeometry().setPositions(segments), material));
	};
	const outlines = (parts: Batch) => {
		for (const faces of [parts.neu, parts.glas])
			if (faces.p.length) objects.add(silhouette(faces, materials.hull));
	};
	const cast = finishes.envelopeShadows();
	const parts = partition(primitives);
	const isSheet = (part: Primitive) => part.kind === 'membrane' && part.role === 'neu';
	const body = batch(
		parts.regular.filter((part) => !isSheet(part)),
		toColor
	);
	const sheets = batch(parts.regular.filter(isSheet), toColor);
	mesh(body.neu, materials.solid, true, cast);
	mesh(body.alt, materials.stock, true);
	mesh(body.hull.alt, materials.pencilHull);
	mesh(body.blatt, materials.sheet, false, cast);
	mesh(sheets.blatt, materials.sheet, false, cast);
	mesh(body.glas, materials.glass);
	outlines(body);
	lines(body.kanten.alt, materials.pencil);
	lines(body.kanten.neu, materials.detail);
	lines(sheets.kanten.neu, materials.perimeter);

	const toAccent = (part: Primitive) => accentColor(part.token, part.shade);
	const accent = batch(
		parts.accents.filter((part) => !isSheet(part)),
		toAccent
	);
	const accentSheets = batch(parts.accents.filter(isSheet), toAccent);
	for (const faces of [accent.neu, accent.blatt, accent.glas, accentSheets.blatt])
		mesh(faces, materials.signal, true, cast);
	outlines(accent);
	lines(accent.kanten.neu, materials.detail);
	lines(accentSheets.kanten.neu, materials.perimeter);

	const main = parts.carriers.filter((part) => !part.member || part.member === 'primary');
	const ties = parts.carriers.filter((part) => part.member === 'secondary');
	lines(batch(main.flatMap(memberTrace), toColor).kanten.neu, materials.primary);
	lines(batch(ties.flatMap(memberTrace), toColor).kanten.neu, materials.secondary);
	const points = parts.carriers.flatMap((part) => part.bearings ?? []);
	if (points.length) objects.add(bearingDots(points, bearingGeometry, materials.bearing));

	const ghost = batch(parts.ghosts, toColor);
	for (const faces of [ghost.alt, ghost.blatt, ghost.neu, ghost.glas])
		mesh(faces, materials.ghost, true);
	lines(ghost.kanten.alt, materials.detail);

	objects.userData.hits = hits;
	return objects;
}
