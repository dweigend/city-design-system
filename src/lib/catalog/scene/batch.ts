/**
 * Gathers primitives into a few geometries (one draw call per material kind) so that a whole
 * district stays walkable. Geometry and edges come from the same source as in
 * parametrik.ts (`build`); common corner-module cases (prism, planar strut frame, flight)
 * are written directly. No materials: the scene decides the look.
 */
import * as THREE from 'three/webgpu';
import type { Primitive, Vec3 } from '../logic/parametrik/types';
import { build } from './parametrik';

type Faces = { p: number[]; n: number[]; c: number[] };
export type Batch = {
	/** Closed volumes of new additions (front faces). */
	neu: Faces;
	/** Existing stock (white architectural model), kept separate for the semi-transparent rendering. */
	alt: Faces;
	/** Thin surfaces, visible from both sides (flights, helices). */
	blatt: Faces;
	glas: Faces;
	/** Round parts for the outline (inverted hull). */
	hull: { neu: Faces; alt: Faces };
	/** Line segments (six numbers each). */
	kanten: { neu: number[]; alt: number[] };
	/** Colored struts: segments and a color per endpoint. */
	staebe: { p: number[]; c: number[] };
	dreiecke: number;
};

const faces = (): Faces => ({ p: [], n: [], c: [] });
const EDGE = Math.cos((46 * Math.PI) / 180);

export function batch(primitives: Primitive[], colorOf: (p: Primitive) => THREE.Color): Batch {
	const out: Batch = {
		neu: faces(),
		alt: faces(),
		blatt: faces(),
		glas: faces(),
		hull: { neu: faces(), alt: faces() },
		kanten: { neu: [], alt: [] },
		staebe: { p: [], c: [] },
		dreiecke: 0
	};
	const matrix = new THREE.Matrix4(),
		normalMatrix = new THREE.Matrix3(),
		quat = new THREE.Quaternion(),
		up = new THREE.Vector3(0, 1, 0),
		one = new THREE.Vector3(1, 1, 1),
		v = new THREE.Vector3();
	// World x/y/z → three x/z/−y.
	const tri = (
		f: Faces,
		c: THREE.Color,
		a: Vec3,
		b: Vec3,
		d: Vec3,
		nx: number,
		ny: number,
		nz: number
	) => {
		f.p.push(a[0], a[2], -a[1], b[0], b[2], -b[1], d[0], d[2], -d[1]);
		for (let k = 0; k < 3; k++) {
			f.n.push(nx, ny, nz);
			f.c.push(c.r, c.g, c.b);
		}
		out.dreiecke++;
	};
	const seg = (target: number[], a: Vec3, b: Vec3) =>
		target.push(a[0], a[2], -a[1], b[0], b[2], -b[1]);

	for (const p of primitives) {
		const role = p.role === 'bestand' ? 'alt' : 'neu';
		if (p.kind === 'polyline') {
			const pts = p.closed ? [...p.points, p.points[0]] : p.points;
			for (let i = 1; i < pts.length; i++) seg(out.kanten[role], pts[i - 1], pts[i]);
			continue;
		}
		const color = colorOf(p);
		if (p.kind === 'prism' && !p.rotation) {
			const target = p.glass ? out.glas : out[role];
			let poly = p.polygon;
			let area = 0;
			for (let i = 0; i < poly.length; i++) {
				const [x0, y0] = poly[i],
					[x1, y1] = poly[(i + 1) % poly.length];
				area += x0 * y1 - x1 * y0;
			}
			if (area < 0) poly = [...poly].reverse();
			const n = poly.length,
				z0 = p.z,
				z1 = p.z + p.height;
			// Caps: fans for convex polygons, ear clipping otherwise.
			let convex = true;
			for (let i = 0; i < n && convex; i++) {
				const a = poly[i],
					b = poly[(i + 1) % n],
					c = poly[(i + 2) % n];
				if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < -1e-9) convex = false;
			}
			const idx = convex
				? Array.from({ length: n - 2 }, (_, i) => [0, i + 1, i + 2])
				: THREE.ShapeUtils.triangulateShape(
						poly.map(([x, y]) => new THREE.Vector2(x, y)),
						[]
					);
			for (const [i, j, k] of idx) {
				const a = poly[i];
				let [b, c] = [poly[j], poly[k]];
				if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) [b, c] = [c, b];
				tri(target, color, [a[0], a[1], z1], [b[0], b[1], z1], [c[0], c[1], z1], 0, 1, 0);
				tri(target, color, [a[0], a[1], z0], [c[0], c[1], z0], [b[0], b[1], z0], 0, -1, 0);
			}
			for (let i = 0; i < n; i++) {
				const a = poly[i],
					b = poly[(i + 1) % n],
					dx = b[0] - a[0],
					dy = b[1] - a[1],
					len = Math.hypot(dx, dy) || 1,
					nx = dy / len,
					nz = dx / len;
				tri(target, color, [a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], nx, 0, nz);
				tri(target, color, [a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1], nx, 0, nz);
				if (p.edges !== false) {
					seg(out.kanten[role], [a[0], a[1], z0], [b[0], b[1], z0]);
					seg(out.kanten[role], [a[0], a[1], z1], [b[0], b[1], z1]);
					const q = poly[(i + n - 1) % n],
						ex = a[0] - q[0],
						ey = a[1] - q[1],
						el = Math.hypot(ex, ey) || 1;
					if ((ex * dx + ey * dy) / (el * len) < EDGE)
						seg(out.kanten[role], [a[0], a[1], z0], [a[0], a[1], z1]);
				}
			}
			continue;
		}
		if (p.kind === 'membrane' && !p.sag) {
			// Planar surface through four points (stair flight): two triangles, double-sided.
			const [a, b, c, d] = p.corners;
			const n = new THREE.Vector3(b[0] - a[0], b[2] - a[2], -(b[1] - a[1]))
				.cross(new THREE.Vector3(d[0] - a[0], d[2] - a[2], -(d[1] - a[1])))
				.normalize();
			if (n.y < 0) n.negate();
			tri(out.blatt, color, a, b, c, n.x, n.y, n.z);
			tri(out.blatt, color, a, c, d, n.x, n.y, n.z);
			if (p.edges !== false) {
				seg(out.kanten[role], a, b);
				seg(out.kanten[role], b, c);
				seg(out.kanten[role], c, d);
				seg(out.kanten[role], d, a);
			}
			continue;
		}
		if (p.kind === 'frame' && p.size[1] <= 0.05 && p.cells.every((n) => n === 1)) {
			// Planar strut panel of the corner modules: two posts, two beams, one diagonal.
			const [sx, , sz] = p.size,
				a = p.rotation ?? 0,
				cx = p.position[0] + sx / 2,
				cy = p.position[1] + p.size[1] / 2,
				cos = (Math.cos(a) * sx) / 2,
				sin = (Math.sin(a) * sx) / 2,
				z0 = p.position[2],
				z1 = z0 + sz;
			const l0: Vec3 = [cx - cos, cy - sin, z0],
				l1: Vec3 = [cx - cos, cy - sin, z1],
				r0: Vec3 = [cx + cos, cy + sin, z0],
				r1: Vec3 = [cx + cos, cy + sin, z1];
			const plain = p.token === '--paper' || p.role === 'bestand';
			const bars: [Vec3, Vec3][] = [
				[l0, l1],
				[r0, r1],
				[l0, r0],
				[l1, r1]
			];
			if (p.braced) bars.push([l0, r1]);
			for (const [s, e] of bars)
				if (plain) seg(out.kanten[role], s, e);
				else {
					seg(out.staebe.p, s, e);
					out.staebe.c.push(color.r, color.g, color.b, color.r, color.g, color.b);
				}
			continue;
		}
		const built = build(p, true);
		// Coplanar surfaces in existing stock (cornice on roof) flicker otherwise: darker ones sit higher.
		if (p.role === 'bestand') built.position.y += (p.shade ?? 0) * 0.1;
		matrix.compose(built.position, quat.setFromAxisAngle(up, built.rotation), one);
		normalMatrix.getNormalMatrix(matrix);
		const pushSegments = (target: number[], source: ArrayLike<number>) => {
			for (let i = 0; i < source.length; i += 3) {
				v.set(source[i], source[i + 1], source[i + 2]).applyMatrix4(matrix);
				target.push(v.x, v.y, v.z);
			}
		};
		if (p.kind === 'frame' && built.rulings) {
			if (p.token === '--paper' || p.role === 'bestand')
				pushSegments(out.kanten[role], built.rulings);
			else {
				const n = out.staebe.p.length;
				pushSegments(out.staebe.p, built.rulings);
				for (let i = n; i < out.staebe.p.length; i += 3)
					out.staebe.c.push(color.r, color.g, color.b);
			}
			built.geometry.dispose();
			continue;
		}
		if (p.edges !== false) {
			if (built.edges !== false) {
				const e = new THREE.EdgesGeometry(built.geometry, built.edgeAngle);
				pushSegments(out.kanten[role], e.getAttribute('position').array);
				e.dispose();
			}
			if (built.rulings) pushSegments(out.kanten[role], built.rulings);
		}
		const g = built.geometry.index ? built.geometry.toNonIndexed() : built.geometry;
		const position = g.getAttribute('position'),
			normal = g.getAttribute('normal'),
			target = p.glass ? out.glas : built.double ? out.blatt : out[role],
			hull = built.outline && !p.glass && p.edges !== false ? out.hull[role] : undefined;
		const w = new THREE.Vector3();
		for (let i = 0; i < position.count; i++) {
			v.fromBufferAttribute(position, i).applyMatrix4(matrix);
			w.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
			target.p.push(v.x, v.y, v.z);
			target.n.push(w.x, w.y, w.z);
			target.c.push(color.r, color.g, color.b);
			if (hull) {
				hull.p.push(v.x, v.y, v.z);
				hull.n.push(w.x, w.y, w.z);
			}
		}
		out.dreiecke += position.count / 3;
		if (g !== built.geometry) g.dispose();
		built.geometry.dispose();
	}
	return out;
}

/** Surfaces → BufferGeometry with position, normal, and color. */
export function geometryOf(f: Faces): THREE.BufferGeometry {
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(f.p, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(f.n, 3));
	if (f.c.length) g.setAttribute('color', new THREE.Float32BufferAttribute(f.c, 3));
	return g;
}
