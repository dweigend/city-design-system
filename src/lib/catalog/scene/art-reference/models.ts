import * as T from 'three';
import type { PlateMaterials } from './materials';
import { buildVessel, composeCollage, type Cell } from '../../logic/art-reference';

const cell: Cell = [
	[-8, -4],
	[0, -6],
	[8, -3],
	[6, 1],
	[2, 1],
	[2, 5],
	[-4, 6],
	[-7, 3]
];
function outline(points: T.Vector3[], material: T.LineBasicMaterial) {
	return new T.LineLoop(new T.BufferGeometry().setFromPoints(points), material);
}

// Short graphite strokes on the shaded return; a 1 mm stand-off prevents z-fighting.
function hatching(width: number, depth: number, height: number, material: T.LineBasicMaterial) {
	const points: T.Vector3[] = [];
	const x = width / 2 + 0.001;
	for (let z = -depth / 2; z < depth / 2 - 0.22; z += 0.22) {
		points.push(new T.Vector3(x, 0, z), new T.Vector3(x, height, z + 0.2));
	}
	return new T.LineSegments(new T.BufferGeometry().setFromPoints(points), material);
}

function foldedInsertion(w: number, h: number, d: number, ink: PlateMaterials) {
	const shape = new T.Shape();
	shape.moveTo(-0.46 * w, 0);
	shape.lineTo(0.46 * w, 0);
	shape.lineTo(0.46 * w, 0.23 * h);
	shape.lineTo(0.1 * w, 0.23 * h);
	shape.lineTo(0.1 * w, 0.4 * h);
	shape.lineTo(-0.46 * w, 0.16 * h);
	shape.closePath();
	const geometry = new T.ExtrudeGeometry(shape, { depth: d * 0.72, bevelEnabled: false });
	geometry.translate(0, 0, -d * 0.36);
	const addition = new T.Mesh(geometry, ink.paper);
	addition.position.y = h;
	addition.rotation.y = 0.19;
	addition.add(new T.LineSegments(new T.EdgesGeometry(geometry), ink.ink));
	return addition;
}

function stock(
	p: ReturnType<typeof composeCollage>[number],
	ink: PlateMaterials,
	intervention: boolean
) {
	const group = new T.Group();
	group.position.set(p.x, 0, -p.y);
	group.rotation.y = p.angle;
	const w = p.radius * 1.56,
		d = p.radius * 1.12,
		h = p.height;
	const ring = (y: number) =>
		[
			[-w, -d],
			[w, -d],
			[w, d],
			[-w, d]
		].map(([x, z]) => new T.Vector3(x / 2, y, z / 2));
	const body = new T.Mesh(new T.BoxGeometry(w, h, d), ink.paper);
	body.position.y = h / 2;
	group.add(body);
	const edges = new T.LineSegments(new T.EdgesGeometry(body.geometry), ink.soft);
	edges.position.y = h / 2;
	group.add(edges);
	for (let floor = 0.55; floor < h; floor += 0.55) group.add(outline(ring(floor), ink.soft));
	group.add(hatching(w, d, h, ink.hatch));
	if (intervention) group.add(foldedInsertion(w, h, d, ink));
	return group;
}

function vesselModel(v: NonNullable<ReturnType<typeof buildVessel>>, ink: PlateMaterials) {
	const profile = [
		...v.rings.map((r) => ({ ...r, radius: r.outer })),
		...v.rings.toReversed().map((r) => ({ ...r, radius: r.inner }))
	];
	const points: number[] = [],
		indices: number[] = [];
	for (const [i, r] of profile.entries()) {
		for (let j = 0; j < 48; j++) {
			const a = (j * Math.PI) / 24;
			points.push(r.offset + r.radius * Math.cos(a), r.z, -r.radius * Math.sin(a));
			const next = ((i + 1) % profile.length) * 48,
				k = i * 48 + j,
				l = i * 48 + ((j + 1) % 48);
			indices.push(k, l, next + j, l, next + ((j + 1) % 48), next + j);
		}
	}
	const geometry = new T.BufferGeometry();
	geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();
	// Each profile interval contributes two triangles per angular segment.
	const strip = 48 * 6;
	const lipStart = (v.rings.length - 1) * strip;
	geometry.addGroup(0, lipStart, 0);
	geometry.addGroup(lipStart, strip, 1);
	geometry.addGroup(lipStart + strip, indices.length - lipStart - strip, 0);
	const mesh = new T.Mesh(geometry, [ink.glaze, ink.water]);
	mesh.position.set(v.base.x, 0, -v.base.y);
	mesh.rotation.y = v.base.angle;
	return mesh;
}

/** Project the same notched plot into a paper-stock composition or a ceramic inlet study. */
export function plateModel(kind: 'collage' | 'vessel', seed: number, ink: PlateMaterials) {
	const group = new T.Group();
	group.add(
		outline(
			cell.map(([x, y]) => new T.Vector3(x, 0, -y)),
			ink.soft
		)
	);
	if (kind === 'collage')
		composeCollage(cell, seed).forEach((p, i) => group.add(stock(p, ink, i === 0)));
	else {
		const v = buildVessel(cell, seed);
		if (v) group.add(vesselModel(v, ink));
	}
	return group;
}
