import * as THREE from 'three/webgpu';
import type { MeshForm, Primitive, Vec3 } from '../../logic/parametrik/types';

const vector = ([x, y, z]: Vec3) => new THREE.Vector3(x, z, -y);
type Face = { plane: THREE.Plane; edges: Map<string, [number, number]> };

// Cancel interior diagonals of coplanar triangles. Remaining edges describe the
// outline, including holes; a ray tests one plane per facet, independent of triangulation.
function facets(form: MeshForm, points: THREE.Vector3[]) {
	const faces: Face[] = [];
	for (let i = 0; i < form.triangles.length; i += 3) {
		const [a, b, c] = form.triangles.slice(i, i + 3);
		const plane = new THREE.Plane().setFromCoplanarPoints(points[a], points[b], points[c]);
		let face = faces.find(
			(f) =>
				f.plane.normal.distanceToSquared(plane.normal) < 1e-10 &&
				[a, b, c].every((v) => Math.abs(f.plane.distanceToPoint(points[v])) < 1e-5)
		);
		if (!face) {
			face = { plane, edges: new Map() };
			faces.push(face);
		}
		for (const [u, v] of [
			[a, b],
			[b, c],
			[c, a]
		]) {
			const key = Math.min(u, v) + ',' + Math.max(u, v);
			if (!face.edges.delete(key)) face.edges.set(key, [u, v]);
		}
	}
	return faces.map((face) => projectOutline(face, points));
}

function projectOutline({ plane, edges }: Face, points: THREE.Vector3[]) {
	const n = plane.normal.toArray().map(Math.abs);
	const drop = n.indexOf(Math.max(...n));
	const u = (drop + 1) % 3,
		v = (drop + 2) % 3;
	return {
		plane,
		u,
		v,
		edges: [...edges.values()].map(([a, b]) => [
			points[a].getComponent(u),
			points[a].getComponent(v),
			points[b].getComponent(u),
			points[b].getComponent(v)
		])
	};
}

function inside(x: number, y: number, edges: number[][]) {
	let odd = false;
	for (const [ax, ay, bx, by] of edges) {
		const crosses = ay > y !== by > y;
		if (crosses && x < ax + ((bx - ax) * (y - ay)) / (by - ay)) odd = !odd;
	}
	return odd;
}

function roofSurface(form: MeshForm, points: THREE.Vector3[], doubleSided: boolean) {
	const polygons = facets(form, points);
	return (caster: THREE.Raycaster) => {
		let nearest: THREE.Vector3 | undefined;
		for (const { plane, u, v, edges } of polygons) {
			if (!doubleSided && plane.normal.dot(caster.ray.direction) >= 0) continue;
			const hit = caster.ray.intersectPlane(plane, new THREE.Vector3());
			if (!hit || !inside(hit.getComponent(u), hit.getComponent(v), edges)) continue;
			if (
				!nearest ||
				caster.ray.origin.distanceToSquared(hit) < caster.ray.origin.distanceToSquared(nearest)
			)
				nearest = hit;
		}
		return nearest;
	};
}

function roofStroke(points: THREE.Vector3[], width: () => number) {
	return (caster: THREE.Raycaster) => {
		const radius = caster.params.Line.threshold * width();
		let nearest: THREE.Vector3 | undefined;
		for (let i = 1; i < points.length; i++) {
			const hit = new THREE.Vector3();
			if (caster.ray.distanceSqToSegment(points[i - 1], points[i], hit) > radius * radius) continue;
			if (
				!nearest ||
				caster.ray.origin.distanceToSquared(hit) < caster.ray.origin.distanceToSquared(nearest)
			)
				nearest = hit;
		}
		return nearest;
	};
}

/** CPU-only roof target. A mesh supplies planar outlines and a fallback line supplies a
 * stroke in CSS pixels. Both keep the identity of the cell that owns the visible roof. */
export function roofPick(part: Primitive, width: () => number) {
	if (!part.roofCell || (part.kind !== 'mesh' && part.kind !== 'polyline')) return undefined;
	const points = part.points.map(vector);
	const bounds = new THREE.Box3().setFromPoints(points);
	const box = new THREE.Box3();
	const intersect =
		part.kind === 'mesh'
			? roofSurface(part, points, part.material === 'ghost')
			: roofStroke(points, width);
	const object = new THREE.Object3D();
	object.userData.cellId = part.roofCell;
	object.raycast = (caster, hits) => {
		const radius = part.kind === 'polyline' ? caster.params.Line.threshold * width() : 0;
		if (!caster.ray.intersectsBox(box.copy(bounds).expandByScalar(radius))) return;
		const point = intersect(caster);
		if (point) hits.push({ object, point, distance: caster.ray.origin.distanceTo(point) });
	};
	return object;
}

/** Detaches baked world-coordinate mesh hits from their render transforms, sharing resources. */
export function seatedTargets<T extends THREE.Object3D>(solids: readonly T[]): T[] {
	return solids.map((solid) => solid.clone(false));
}
