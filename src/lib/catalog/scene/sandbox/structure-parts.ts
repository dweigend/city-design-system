import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { type Primitive, type Vec3 } from '../../logic/parametrik/types';
import { batch, type Batch } from '../batch';
import type { StructuralJoint } from '../../logic/structural-joints';
import { pushThree } from '../world-space';
import type { StructureMaterials } from './structure-materials';
import { conduitBatch } from './print-flow';
import { paperEdge } from './paper-inlay';
import { ceramicBatch } from './ceramic-batch';
import { stockDetail } from './stock-detail';
import { partition } from './structure-layers';
import { finishedMeshes, type Surface } from './finish-batch';
import { printBatch, printGeometry } from './print-batch';
import { glazeContourMaterial, hasGlazeContour, silhouette } from './structure-outline';

/** Bakes the local fittings into one ink draw, leaving them out of the picking geometry. */
export function jointMesh(joints: readonly StructuralJoint[], material: THREE.Material) {
	if (!joints.length) return;
	const positions: number[] = [];
	const indices: number[] = [];
	const axis = new THREE.Vector3(),
		tangent = new THREE.Vector3(),
		bitangent = new THREE.Vector3();
	const point = new THREE.Vector3(),
		origin = new THREE.Vector3();
	for (const joint of joints) {
		axis.fromArray(joint.axis);
		tangent.fromArray(joint.tangent);
		bitangent.crossVectors(axis, tangent);
		origin.fromArray(joint.point);
		for (const feature of joint.geometry) {
			const start = positions.length / 3;
			for (const [x, y, z] of feature.points) {
				point
					.copy(origin)
					.addScaledVector(tangent, x)
					.addScaledVector(bitangent, y)
					.addScaledVector(axis, z);
				pushThree(positions, [point.x, point.y, point.z]);
			}
			for (const index of feature.triangles) indices.push(start + index);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setIndex(indices);
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = 'Structural joints';
	return mesh;
}

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

const isSheet = (part: Primitive) => part.kind === 'membrane' && part.role === 'neu';

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
	const { materials, colorOf, accentColor, surfaceColor: toColor } = finishes;
	const objects = new THREE.Group();
	const hits: THREE.Mesh[] = [];
	const mesh = (faces: Batch['neu'], material: THREE.Material, pick = false) => {
		if (!faces.p.length) return;
		const object = new THREE.Mesh(printGeometry(faces), material);
		objects.add(object);
		if (pick) hits.push(object);
		return object;
	};
	const lines = (segments: number[], material: THREE.Line2NodeMaterial) => {
		if (segments.length) {
			const line = new LineSegments2(new LineSegmentsGeometry().setPositions(segments), material);
			if (material.dashed) line.computeLineDistances();
			objects.add(line);
		}
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
	drawFinishes(parts.finished, { contour: true });
	drawFinishes(parts.unoutlinedFinishes, { contour: false });
	drawStockAndBodies();

	drawSpecialSurfaces();
	drawAccents();

	drawCarriers();

	const ghost = batch(parts.ghosts, toColor);
	for (const faces of [ghost.alt, ghost.blatt, ghost.neu, ghost.glas])
		mesh(faces, materials.ghost, true);
	lines(ghost.kanten.alt, materials.detail);

	objects.userData.hits = hits;
	return objects;

	function drawFinishes(surfaces: Surface[], { contour }: { contour: boolean }) {
		for (const face of finishedMeshes(surfaces, finishes.explicit)) {
			face.castShadow = cast;
			face.receiveShadow = true;
			objects.add(face);
			if (contour && hasGlazeContour(face.material.name))
				objects.add(silhouette(face.geometry, glazeContourMaterial(finishes.glazeContour)));
			hits.push(face);
		}
	}

	function drawCarriers() {
		const current = parts.carriers.filter(
			(p) => p.role !== 'bestand' && !p.planned && p.sectionDiameter !== 0.14
		);
		lines(
			batch(parts.carriers.filter((p) => p.planned).flatMap(memberTrace), toColor).kanten.neu,
			materials.planned
		);
		lines(
			batch(
				parts.carriers
					.filter((p) => !p.planned && p.role !== 'bestand' && p.sectionDiameter === 0.14)
					.flatMap(memberTrace),
				toColor
			).kanten.neu,
			materials.rib
		);
		const agedMembers = parts.carriers.filter((p) => p.role === 'bestand');
		const inkMembers = current.filter((p) => p.token === '--ink');
		for (const [select, material] of [
			[(p: Primitive) => p.detail, materials.braceInk],
			[(p: Primitive) => !p.detail && p.sectionDiameter === 0.12, materials.portalInk],
			[(p: Primitive) => !p.detail && p.sectionDiameter !== 0.12, materials.carrierInk]
		] as const)
			lines(batch(inkMembers.filter(select).flatMap(memberTrace), toColor).kanten.neu, material);
		const legacy = current.filter((p) => p.token !== '--ink');
		const main = legacy.filter((p) => !p.member || p.member === 'primary');
		const ties = legacy.filter((p) => p.member === 'secondary' && !p.detail);
		const rails = legacy.filter((p) => p.member === 'secondary' && p.detail);
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
		// Explicit bearing nodes with no axial member retain their existing ink mark.
		const points = parts.carriers.flatMap((part) =>
			part.kind === 'sphere' || part.token === '--ink' ? (part.bearings ?? []) : []
		);
		if (details && points.length)
			objects.add(bearingDots(points, bearingGeometry, materials.bearing));
	}

	function drawAccents() {
		const accent = batch(
			parts.accents.filter((part) => !isSheet(part)),
			accentColor
		);
		const accentSheets = batch(parts.accents.filter(isSheet), accentColor);
		surface(accent.neu, materials.signal, materials.hull, true);
		surface(accent.glas, materials.signal, materials.hull, true);
		for (const faces of [accent.blatt, accentSheets.blatt, accentSheets.glas])
			surface(faces, materials.signal, materials.sheetHull, true);
		lines(accent.kanten.neu, materials.detail);
		lines(accentSheets.kanten.neu, materials.perimeter);
		const plainAccents = batch(parts.plainAccents, accentColor);
		for (const faces of [plainAccents.neu, plainAccents.blatt, plainAccents.glas])
			fill(faces, materials.signal, true);
	}

	function drawSpecialSurfaces() {
		const conduit = conduitBatch(parts.conduits, toColor);
		const pipes = surface(conduit.faces, materials.conduit, materials.hull, true);
		pipes?.geometry.setAttribute('stationM', conduit.axis);
		pipes?.geometry.setAttribute('railMark', conduit.rail);
		const print = printBatch(parts.inlays, (p) =>
			p.token.startsWith('--cat-business')
				? toColor(p)
				: colorOf(p.token.replace(/-\d$/, '') + '-2')
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
		const portal = mesh(printBatch(parts.portals, toColor).neu, materials.solid, true);
		if (portal) {
			portal.castShadow = cast;
			objects.add(paperEdge(portal.geometry, materials.cut));
		}
		const pigments = new Map(
			primitives
				.filter(
					(p) =>
						p.role === 'neu' &&
						p.token.startsWith('--cat-') &&
						/\/(fitting|vessel|feed)$/.test(p.id)
				)
				.map((p) => [
					p.id.endsWith('/fitting')
						? p.id.slice(0, -8)
						: p.id.replace(/\/(vessel|feed)$/, '/module'),
					p
				])
		);
		const fired = ceramicBatch(parts.ceramics, pigments, (part) =>
			part.token === '--paper' ? finishes.modelWhite : accentColor(part)
		);
		if (fired.geometry) {
			const casting = new THREE.Mesh(fired.geometry, materials.fired);
			casting.castShadow = cast;
			objects.add(casting, silhouette(fired.geometry, materials.hull));
			hits.push(casting);
		}
		lines(fired.edges, materials.detail);
	}

	function drawStockAndBodies() {
		const stock = batch(
			parts.regular.filter((part) => part.role === 'bestand'),
			toColor
		);
		const body = printBatch(
			parts.regular.filter((part) => part.role !== 'bestand' && !isSheet(part)),
			toColor
		);
		const sheets = printBatch(parts.regular.filter(isSheet), toColor);
		surface(body.neu, materials.solid, materials.hull, true);
		surface(printBatch(parts.drawers, toColor).neu, materials.solid, materials.printHull, true);
		surface(printBatch(parts.pods, toColor).neu, materials.pod, materials.printHull, true);
		fill(printBatch(parts.plainPods, toColor).neu, materials.pod, true);
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
		const plain = printBatch(parts.plain, toColor);
		fill(plain.neu, materials.solid, true);
		fill(plain.blatt, materials.sheet, false);
		fill(plain.glas, materials.glass, false, false);
	}
}
