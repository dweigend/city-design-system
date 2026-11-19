import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { type Primitive, type Vec3 } from '../../logic/parametrik/types';
import { batch, geometryOf, type Batch } from '../batch';
import type { StructureMaterials } from './structure-materials';
import { conduitBatch } from './print-flow';
import { paperEdge } from './paper-inlay';
import { ceramicBatch } from './ceramic-batch';
import { stockDetail } from './stock-detail';
import { partition } from './structure-layers';
import { finishedMeshes } from './finish-batch';
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

function silhouette(source: THREE.BufferGeometry, material: THREE.Material) {
	const geometry = new THREE.InstancedBufferGeometry();
	geometry.setAttribute('position', source.getAttribute('position'));
	geometry.setIndex(source.index);
	geometry.setAttribute('outlineOffset', outlineOffsets);
	geometry.instanceCount = outlineOffsets.count;
	return new THREE.Mesh(geometry, material);
}

/** Projects one structure key into pickable surfaces and independent drafting marks. */
export function populateStructures(
	primitives: Primitive[],
	finishes: StructureMaterials,
	bearingGeometry: THREE.BufferGeometry,
	{
		unoutlined = new Set<Primitive>(),
		details = true
	}: {
		unoutlined?: ReadonlySet<Primitive>;
		details?: boolean;
	} = {}
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
		objects.add(silhouette(object.geometry, contour));
		return object;
	};
	const fill = (faces: Batch['neu'], material: THREE.Material, pick: boolean, shadows = cast) => {
		const object = mesh(faces, material, pick);
		if (object) object.castShadow = shadows;
	};
	const parts = partition(primitives, unoutlined);
	for (const face of finishedMeshes(parts.finished, finishes.explicit.material)) {
		face.castShadow = cast;
		objects.add(face);
		hits.push(face);
	}
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
	for (const part of parts.glaze) {
		if (part.kind !== 'mesh') continue;
		const geometry = new THREE.BufferGeometry().setFromPoints(
			part.points.map(([x, y, z]) => new THREE.Vector3(x, z, -y))
		);
		geometry.setIndex(part.triangles);
		geometry.computeVertexNormals();
		const face = new THREE.Mesh(geometry, materials.glaze);
		face.castShadow = cast;
		hits.push(face);
		objects.add(face);
		if (!unoutlined.has(part)) objects.add(new THREE.Mesh(geometry, materials.ceramicHull));
	}
	surface(body.neu, materials.solid, materials.hull, true);
	mesh(stock.alt, materials.stock, true);
	mesh(stock.blatt, materials.stockSheet);
	mesh(stock.glas, materials.stockSheet);
	mesh(stock.hull.alt, materials.pencilHull);
	surface(body.blatt, materials.sheet, materials.sheetHull, false);
	surface(sheets.blatt, materials.sheet, materials.sheetHull, false);
	surface(body.glas, materials.glass, materials.hull, false, false);
	lines(stock.kanten.alt, materials.pencil);
	if (details) lines(stockDetail(parts.regular), materials.stockDetail);
	lines(body.kanten.neu, materials.detail);
	lines(sheets.kanten.neu, materials.perimeter);
	const plain = batch(parts.plain, toColor);
	fill(plain.neu, materials.solid, true);
	fill(plain.blatt, materials.sheet, false);
	fill(plain.glas, materials.glass, false, false);

	const conduit = conduitBatch(parts.conduits, toColor);
	const pipes = surface(conduit.faces, materials.conduit, materials.hull, true);
	pipes?.geometry.setAttribute('stationM', conduit.axis);
	pipes?.geometry.setAttribute('railMark', conduit.rail);
	const print = batch(parts.inlays, (p) =>
		p.token === '--cat-business' ? toColor(p) : colorOf(p.token.replace(/-\d$/, '') + '-2')
	);
	const chips = batch(parts.inlays, (p) =>
		colorOf(p.token === '--cat-business' ? '--cat-business-2' : p.token.replace(/-\d$/, ''))
	);
	const inlay = mesh(print.neu, materials.inlay, true);
	if (inlay) {
		inlay.geometry.setAttribute('chipColor', new THREE.Float32BufferAttribute(chips.neu.c, 3));
		inlay.castShadow = cast;
		objects.add(paperEdge(inlay.geometry, materials.cut));
	}
	const portal = mesh(batch(parts.portals, toColor).neu, materials.solid, true);
	if (portal) {
		portal.castShadow = cast;
		objects.add(paperEdge(portal.geometry, materials.cut));
	}
	const pigments = new Map(
		primitives
			.filter(
				(p) =>
					p.role === 'neu' && p.token.startsWith('--cat-') && /\/(fitting|vessel|feed)$/.test(p.id)
			)
			.map((p) => [
				p.id.endsWith('/fitting') ? p.id.slice(0, -8) : p.id.replace(/\/(vessel|feed)$/, '/module'),
				p
			])
	);
	const fired = ceramicBatch(parts.ceramics, pigments, (part) =>
		part.token === '--paper' ? finishes.modelWhite : accentColor(part.token, part.shade)
	);
	if (fired.geometry) {
		const casting = new THREE.Mesh(fired.geometry, materials.fired);
		casting.castShadow = cast;
		objects.add(casting, silhouette(fired.geometry, materials.hull));
		hits.push(casting);
	}
	lines(fired.edges, materials.detail);
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
	const plainAccents = batch(parts.plainAccents, toAccent);
	for (const faces of [plainAccents.neu, plainAccents.blatt, plainAccents.glas])
		fill(faces, materials.signal, true);

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
	if (details && points.length)
		objects.add(bearingDots(points, bearingGeometry, materials.bearing));

	const ghost = batch(parts.ghosts, toColor);
	for (const faces of [ghost.alt, ghost.blatt, ghost.neu, ghost.glas])
		mesh(faces, materials.ghost, true);
	lines(ghost.kanten.alt, materials.detail);

	objects.userData.hits = hits;
	return objects;
}
