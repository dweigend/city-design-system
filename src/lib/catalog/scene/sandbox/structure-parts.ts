import { HOUSE_FRAME } from '../../data/house-body';
import { studioShadow } from '../studio-shadow';
import * as THREE from 'three/webgpu';
import { LineSegments2 } from 'three/examples/jsm/lines/webgpu/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { type Primitive, type Vec3 } from '../../logic/parametrik/types';
import { batch, batchFaces, type Batch } from '../batch';
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

function carrierStroke(p: Primitive, materials: StructureMaterials['materials']) {
	if (p.planned) return materials.planned;
	if (p.role === 'bestand')
		return p.member === 'primary' ? materials.stockPrimary : materials.pencil;
	if (p.token === HOUSE_FRAME.token) {
		if (p.member === 'alternate') return;
		return p.detail || p.member === 'secondary' ? materials.houseSecondary : materials.housePrimary;
	}
	return draftingStroke(p, materials);
}

function draftingStroke(p: Primitive, materials: StructureMaterials['materials']) {
	if (p.sectionDiameter === 0.14) return materials.rib;
	if (p.token === '--ink') {
		if (p.detail) return materials.braceInk;
		return p.sectionDiameter === 0.12 ? materials.portalInk : materials.carrierInk;
	}
	if (p.member === 'alternate') return;
	if (p.member === 'secondary') return p.detail ? materials.rail : materials.secondary;
	return materials.primary;
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
	const { contours, materials, accentColor, surfaceColor: toColor } = finishes;
	const objects = new THREE.Group();
	const hits: THREE.Mesh[] = [];
	const mesh = (faces: Batch['neu'], material: THREE.Material, pick = false) => {
		if (!faces.p.length) return;
		const object = new THREE.Mesh(printGeometry(faces), material);
		object.receiveShadow =
			material === materials.stock ||
			material === materials.stockSheet ||
			material instanceof THREE.MeshStandardNodeMaterial;
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
		contour: THREE.Material | undefined,
		pick: boolean,
		shadows = cast
	) => {
		const object = mesh(faces, material, pick);
		if (!object) return;
		object.castShadow = shadows;
		if (contour) objects.add(silhouette(object.geometry, contour));
		return object;
	};
	const fill = (faces: Batch['neu'], material: THREE.Material, pick: boolean, shadows = cast) => {
		const object = mesh(faces, material, pick);
		if (object) object.castShadow = shadows;
	};
	const cityParts = contours
		? primitives
		: primitives.filter((p) => !(p.role === 'bestand' && p.detail));
	const parts = partition(cityParts, unoutlined, !contours);
	drawFinishes(parts.finished, { contour: true });
	drawFinishes(parts.unoutlinedFinishes, { contour: false });
	drawStockAndBodies();

	drawSpecialSurfaces();
	drawAccents();

	drawCarriers();

	const ghost = batchFaces(parts.ghosts, toColor);
	for (const faces of [ghost.alt, ghost.blatt, ghost.neu, ghost.glas])
		mesh(faces, materials.ghost, true);
	lines(ghost.kanten.alt, materials.detail);

	objects.userData.hits = hits;
	return objects;

	function drawFinishes(surfaces: Surface[], { contour }: { contour: boolean }) {
		for (const face of finishedMeshes(surfaces, finishes.explicit)) {
			studioShadow(face, face.material);
			face.castShadow &&= cast;
			objects.add(face);
			if (contours && contour && hasGlazeContour(face.material.name))
				objects.add(silhouette(face.geometry, glazeContourMaterial(contours.glaze)));
			hits.push(face);
		}
	}

	function drawCarriers() {
		const groups = new Map<THREE.Line2NodeMaterial, Primitive[]>();
		for (const part of parts.carriers) {
			const stroke = carrierStroke(part, materials);
			if (!stroke) continue;
			const traces = groups.get(stroke) ?? [];
			traces.push(...memberTrace(part));
			groups.set(stroke, traces);
		}
		for (const [stroke, traces] of groups) lines(batchFaces(traces, toColor).kanten.neu, stroke);
		// Only declared seats on installed members receive a bearing mark.
		const points = parts.carriers.flatMap((part) =>
			!part.planned && part.role === 'traeger' ? (part.bearings ?? []) : []
		);
		if (details && points.length)
			objects.add(bearingDots(points, bearingGeometry, materials.bearing));
	}

	function drawAccents() {
		const accent = batchFaces(
			parts.accents.filter((part) => !isSheet(part)),
			accentColor
		);
		const accentSheets = batchFaces(parts.accents.filter(isSheet), accentColor);
		surface(accent.neu, materials.signal, contours?.hull, true);
		surface(accent.glas, materials.signal, contours?.hull, true);
		for (const faces of [accent.blatt, accentSheets.blatt, accentSheets.glas])
			surface(faces, materials.signal, contours?.sheet, true);
		lines(accent.kanten.neu, materials.detail);
		lines(accentSheets.kanten.neu, materials.perimeter);
		const plainAccents = batchFaces(parts.plainAccents, accentColor);
		for (const faces of [plainAccents.neu, plainAccents.blatt, plainAccents.glas])
			fill(faces, materials.signal, true);
	}

	function drawSpecialSurfaces() {
		const conduit = conduitBatch(parts.conduits, toColor);
		const pipes = surface(conduit.faces, materials.conduit, contours?.hull, true);
		pipes?.geometry.setAttribute('stationM', conduit.axis);
		pipes?.geometry.setAttribute('railMark', conduit.rail);
		const inlays = parts.inlays.flatMap((p) =>
			p.kind === 'polyline' ? [] : [{ ...p, finish: 'print-terrazzo' as const }]
		);
		for (const face of finishedMeshes(inlays, finishes.explicit)) {
			face.castShadow = cast;
			objects.add(face);
			if (contours) objects.add(paperEdge(face.geometry, contours.cut));
			hits.push(face);
		}
		const portal = mesh(printBatch(parts.portals, toColor).neu, materials.solid, true);
		if (portal) {
			portal.castShadow = cast;
			if (contours) objects.add(paperEdge(portal.geometry, contours.cut));
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
		const fired = ceramicBatch(parts.ceramics, pigments, (slot) =>
			finishes.explicit.material(slot)
		);
		for (const casting of fired.meshes) {
			casting.castShadow = cast;
			objects.add(casting);
			if (contours) objects.add(silhouette(casting.geometry, contours.hull));
			hits.push(casting);
		}
		lines(fired.edges, materials.detail);
	}

	function drawStock() {
		const stock = (contours ? batch : batchFaces)(
			parts.regular.filter((part) => part.role === 'bestand'),
			toColor
		);
		fill(stock.alt, materials.stock, true, !contours);
		mesh(stock.blatt, materials.stockSheet);
		mesh(stock.glas, materials.stockSheet);
		if (contours && stock.hull) mesh(stock.hull.alt, contours.pencil);
		lines(stock.kanten.alt, materials.pencil);
		if (contours && details) lines(stockDetail(parts.regular), materials.stockDetail);
	}

	function drawStockAndBodies() {
		drawStock();
		const body = printBatch(
			parts.regular.filter((part) => part.role !== 'bestand' && !isSheet(part)),
			toColor
		);
		const sheets = printBatch(parts.regular.filter(isSheet), toColor);
		surface(body.neu, materials.solid, contours?.hull, true);
		surface(printBatch(parts.drawers, toColor).neu, materials.solid, contours?.print, true);
		surface(printBatch(parts.pods, toColor).neu, materials.pod, contours?.print, true);
		fill(printBatch(parts.plainPods, toColor).neu, materials.pod, true);
		surface(body.blatt, materials.sheet, contours?.sheet, false);
		surface(sheets.blatt, materials.sheet, contours?.sheet, false);
		surface(body.glas, materials.glass, contours?.hull, false, false);
		lines(body.kanten.neu, materials.detail);
		lines(sheets.kanten.neu, materials.perimeter);
		const plain = printBatch(parts.plain, toColor);
		fill(plain.neu, materials.solid, true);
		fill(plain.blatt, materials.sheet, false);
		fill(plain.glas, materials.glass, false, false);
	}
}
