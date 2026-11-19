import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { isStructural, type Primitive, type Vec3 } from '../../logic/parametrik/types';
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

const isAccent = (part: Primitive) =>
	part.role === 'neu' && !part.envelope && part.token.startsWith('--cat-');

function layerOf(part: Primitive) {
	if (part.material === 'ghost') return 'ghosts';
	if (isStructural(part)) return 'carriers';
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
	const mesh = (faces: Batch['neu'], material: THREE.Material, pick = false) => {
		if (!faces.p.length) return;
		const object = new THREE.Mesh(geometryOf(faces), material);
		objects.add(object);
		if (pick) hits.push(object);
		return object;
	};
	const lines = (segments: number[], material: THREE.Line2NodeMaterial) => {
		if (segments.length)
			objects.add(new LineSegments2(new LineSegmentsGeometry().setPositions(segments), material));
	};
	const cast = finishes.envelopeShadows();
	const surface = (
		faces: Batch['neu'],
		material: THREE.Material,
		contour: THREE.Material,
		pick: boolean,
		shadows = cast
	) => {
		const object = mesh(faces, material, pick);
		if (!object) return;
		object.castShadow = shadows;
		objects.add(silhouette(faces, contour));
	};
	const parts = partition(primitives);
	const isSheet = (part: Primitive) => part.kind === 'membrane' && part.role === 'neu';
	const stock = batch(
		parts.regular.filter((part) => part.role === 'bestand'),
		toColor
	);
	const body = batch(
		parts.regular.filter((part) => part.role !== 'bestand' && !isSheet(part)),
		toColor
	);
	const sheets = batch(parts.regular.filter(isSheet), toColor);
	surface(body.neu, materials.solid, materials.hull, true);
	mesh(stock.alt, materials.stock, true);
	mesh(stock.blatt, materials.stockSheet);
	mesh(stock.glas, materials.stockSheet);
	mesh(stock.hull.alt, materials.pencilHull);
	surface(body.blatt, materials.sheet, materials.sheetHull, false);
	surface(sheets.blatt, materials.sheet, materials.sheetHull, false);
	surface(body.glas, materials.glass, materials.hull, false, false);
	lines(stock.kanten.alt, materials.pencil);
	lines(body.kanten.neu, materials.detail);
	lines(sheets.kanten.neu, materials.perimeter);

	const toAccent = (part: Primitive) => accentColor(part.token, part.shade);
	const accent = batch(
		parts.accents.filter((part) => !isSheet(part)),
		toAccent
	);
	const accentSheets = batch(parts.accents.filter(isSheet), toAccent);
	surface(accent.neu, materials.signal, materials.hull, true);
	surface(accent.glas, materials.signal, materials.hull, true);
	for (const faces of [accent.blatt, accentSheets.blatt, accentSheets.glas])
		surface(faces, materials.signal, materials.sheetHull, true);
	lines(accent.kanten.neu, materials.detail);
	lines(accentSheets.kanten.neu, materials.perimeter);

	const current = parts.carriers.filter((p) => p.role !== 'bestand');
	const agedMembers = parts.carriers.filter((p) => p.role === 'bestand');
	const main = current.filter((p) => !p.member || p.member === 'primary');
	const ties = current.filter((p) => p.member === 'secondary' && !p.detail);
	const rails = current.filter((p) => p.member === 'secondary' && p.detail);
	lines(batch(main.flatMap(memberTrace), toColor).kanten.neu, materials.primary);
	lines(batch(ties.flatMap(memberTrace), toColor).kanten.neu, materials.secondary);
	lines(batch(rails.flatMap(memberTrace), toColor).kanten.neu, materials.rail);
	lines(
		batch(agedMembers.filter((p) => p.member === 'primary').flatMap(memberTrace), toColor).kanten
			.neu,
		materials.stockPrimary
	);
	lines(
		batch(agedMembers.filter((p) => p.member !== 'primary').flatMap(memberTrace), toColor).kanten
			.neu,
		materials.pencil
	);
	const points = parts.carriers.flatMap((part) => part.bearings ?? []);
	if (points.length) objects.add(bearingDots(points, bearingGeometry, materials.bearing));

	const ghost = batch(parts.ghosts, toColor);
	for (const faces of [ghost.alt, ghost.blatt, ghost.neu, ghost.glas])
		mesh(faces, materials.ghost, true);
	lines(ghost.kanten.alt, materials.detail);

	objects.userData.hits = hits;
	return objects;
}
