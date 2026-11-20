import type { Primitive, Vec3 } from '../parametrik/types';
import { wallContacts, type TerrainGrid } from '../terrain-grid';

type Mesh = Extract<Primitive, { kind: 'mesh' }>;
type Edge = [Vec3, Vec3];
const tolerance = 1e-8; // Metres at the horizontal shell seat.

/** Finds the directed foot of each surviving panel triangle after door and party-wall cuts. */
export function lowerShellEdges(mesh: Mesh, seat: number): Edge[] {
	const edges: Edge[] = [];
	for (let i = 0; i < mesh.triangles.length; i += 3) {
		const face = mesh.triangles.slice(i, i + 3).map((j) => mesh.points[j]);
		const high = face.findIndex((p) => p[2] > seat + tolerance);
		if (high < 0) continue;
		const a = face[(high + 1) % 3],
			b = face[(high + 2) % 3];
		if (Math.abs(a[2] - seat) <= tolerance && Math.abs(b[2] - seat) <= tolerance)
			edges.push([a, b]);
	}
	return edges;
}

function appendProfile(points: Vec3[], triangles: number[], stations: Vec3[], footZ: number) {
	for (const [i, right] of stations.slice(1).entries()) {
		const left = stations[i];
		if (left[2] >= footZ && right[2] >= footZ) continue;
		const n = points.length;
		points.push(left, right, [right[0], right[1], footZ], [left[0], left[1], footZ]);
		if (right[2] < footZ) triangles.push(n, n + 1, n + 2);
		if (left[2] < footZ) triangles.push(n, n + 2, n + 3);
	}
}

function appendContacts(
	points: Vec3[],
	triangles: number[],
	contacts: ReturnType<typeof wallContacts>,
	footZ: number
) {
	for (const contact of contacts) {
		if (contact.kind !== 'surveyed') continue;
		const paving =
			contact.frontage?.retainingOwner === 'envelope' ? contact.court?.pavingZ : undefined;
		const stations = contact.stations.map(({ x, y, groundZ }): Vec3 => [
			x,
			y,
			Math.min(groundZ, paving ?? Infinity, footZ)
		]);
		appendProfile(points, triangles, stations, footZ);
	}
}

/** Continues visible wall spans down to the grade at the wall, including shared retaining faces. */
export function groundPanels(part: Primitive, edges: Edge[], grid: TerrainGrid): Primitive[] {
	const points: Vec3[] = [],
		triangles: number[] = [];
	for (const [edge, [a, b]] of edges.entries()) {
		const footZ = a[2];
		const contacts = wallContacts(grid, {
			houseId: part.id,
			ring: 0,
			edge,
			a: [a[0], a[1]],
			b: [b[0], b[1]],
			start: 0,
			end: 1,
			footZ,
			use: 'wall'
		});
		appendContacts(points, triangles, contacts, footZ);
	}
	return triangles.length
		? [
				{
					kind: 'mesh',
					id: part.id + '/ground',
					role: part.role,
					buildingSurface: part.buildingSurface,
					material: part.material,
					points,
					triangles,
					lines: []
				}
			]
		: [];
}
