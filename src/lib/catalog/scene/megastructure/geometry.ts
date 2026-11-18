import * as T from 'three';
import type { Vec3 } from '../../logic/traeger';
/** Builds a lit solid in local meters with optional crease edges. */
export function solid(g: T.BufferGeometry, color: string, ink?: string) {
	const mesh = new T.Mesh(
		g,
		new T.MeshStandardMaterial({
			color,
			roughness: 0.78,
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		})
	);
	if (ink)
		mesh.add(
			new T.LineSegments(new T.EdgesGeometry(g, 35), new T.LineBasicMaterial({ color: ink }))
		);
	return mesh;
}
/** A straight cylindrical member between world endpoints in meters. */
export function rod(a: Vec3, b: Vec3, r: number, color: string) {
	const v = new T.Vector3(...a),
		w = new T.Vector3(...b),
		d = w.clone().sub(v);
	const mesh = solid(new T.CylinderGeometry(r, r, d.length(), 8), color);
	mesh.position.copy(v.add(w).multiplyScalar(0.5));
	mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
	return mesh;
}
/** Extrudes an ordered ground ring from its base in meters. */
export function prism(
	points: readonly (readonly [number, number])[],
	z: number,
	height: number,
	color: string,
	ink?: string
) {
	const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
	const mesh = solid(
		new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }),
		color,
		ink
	);
	mesh.position.z = z;
	return mesh;
}
