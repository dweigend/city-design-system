import * as T from 'three';
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
type Inks = { paper: string; ink: string; soft: string; water: string; glaze: string };

function outline(points: T.Vector3[], color: string) {
	return new T.LineLoop(
		new T.BufferGeometry().setFromPoints(points),
		new T.LineBasicMaterial({ color })
	);
}

// Short graphite strokes on the shaded return; a 1 mm stand-off prevents z-fighting.
function hatching(width: number, depth: number, height: number, color: string) {
	const points: T.Vector3[] = [];
	const x = width / 2 + 0.001;
	for (let z = -depth / 2; z < depth / 2 - 0.22; z += 0.22) {
		points.push(new T.Vector3(x, 0, z), new T.Vector3(x, height, z + 0.2));
	}
	return new T.LineSegments(
		new T.BufferGeometry().setFromPoints(points),
		new T.LineBasicMaterial({ color, transparent: true, opacity: 0.48 })
	);
}

function foldedInsertion(w: number, h: number, d: number, ink: Inks) {
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
	const addition = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: ink.paper }));
	addition.position.y = h;
	addition.rotation.y = 0.19;
	addition.add(
		new T.LineSegments(new T.EdgesGeometry(geometry), new T.LineBasicMaterial({ color: ink.ink }))
	);
	return addition;
}

function stock(p: ReturnType<typeof composeCollage>[number], ink: Inks, intervention: boolean) {
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
	const body = new T.Mesh(
		new T.BoxGeometry(w, h, d),
		new T.MeshBasicMaterial({ color: ink.paper })
	);
	body.position.y = h / 2;
	group.add(body);
	const edges = new T.LineSegments(
		new T.EdgesGeometry(body.geometry),
		new T.LineBasicMaterial({ color: ink.soft })
	);
	edges.position.y = h / 2;
	group.add(edges);
	for (let floor = 0.55; floor < h; floor += 0.55) group.add(outline(ring(floor), ink.soft));
	group.add(hatching(w, d, h, ink.soft));
	if (intervention) group.add(foldedInsertion(w, h, d, ink));
	return group;
}

function vesselModel(v: NonNullable<ReturnType<typeof buildVessel>>, ink: Inks) {
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
	const mesh = new T.Mesh(
		geometry,
		new T.MeshStandardMaterial({ color: ink.glaze, roughness: 0.56 })
	);
	mesh.position.set(v.base.x, 0, -v.base.y);
	mesh.rotation.y = v.base.angle;
	const lip = v.rings[v.rings.length - 1];
	const rim = new T.Mesh(
		new T.TorusGeometry((lip.inner + lip.outer) / 2, (lip.outer - lip.inner) * 0.28, 10, 64),
		new T.MeshStandardMaterial({ color: ink.water })
	);
	rim.rotation.x = Math.PI / 2;
	rim.position.set(lip.offset, lip.z, 0);
	mesh.add(rim);
	return mesh;
}

/** Project the same notched plot into a paper-stock composition or a ceramic inlet study. */
export function plateModel(kind: 'collage' | 'vessel', seed: number, ink: Inks) {
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
