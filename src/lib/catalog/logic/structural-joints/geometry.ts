import { joinRings } from '../profile-fit';
import type { Vec3 } from '../traeger';

export type JointMesh = {
	feature: 'plate' | 'dot' | 'jaw' | 'bolt';
	points: Vec3[];
	triangles: number[];
};

function cap(mesh: JointMesh, start: number, count: number, reverse: boolean) {
	for (let i = 1; i < count - 1; i++) {
		const a = start + i,
			b = a + 1;
		mesh.triangles.push(start, reverse ? b : a, reverse ? a : b);
	}
}

function band(
	r: number,
	w: number,
	from: number,
	to: number,
	steps: number,
	shoe: boolean
): JointMesh {
	const mesh: JointMesh = { feature: shoe ? 'plate' : 'jaw', points: [], triangles: [] };
	const angle = (to - from) / steps;
	// The straight inner facets are tangent to the round member, including between vertices.
	const inner = r / Math.cos(angle / 2);
	for (let i = 0; i <= steps; i++) {
		const t = from + i * angle;
		for (const [radius, z] of [
			[inner, 0],
			[inner, w * 0.65],
			[inner + w * 0.7, w * 0.65],
			[inner + w * 0.7, 0]
		]) {
			mesh.points.push([radius * Math.cos(t), radius * Math.sin(t), z]);
		}
		if (i > 0) joinRings(mesh.triangles, (i - 1) * 4, i * 4, 4);
	}
	if (!shoe) {
		cap(mesh, 0, 4, true);
		cap(mesh, steps * 4, 4, false);
	}
	return mesh;
}

function pin(feature: 'bolt' | 'dot', radius: number, length: number, center: Vec3): JointMesh {
	const mesh: JointMesh = { feature, points: [], triangles: [] };
	for (const end of [-length / 2, length / 2]) {
		for (let i = 0; i < 8; i++) {
			const t = (i * Math.PI) / 4;
			const x = radius * Math.cos(t),
				y = radius * Math.sin(t);
			const [cx, cy, cz] = center;
			mesh.points.push(feature === 'dot' ? [cx + x, cy + y, cz + end] : [cx + x, cy + end, cz - y]);
		}
	}
	joinRings(mesh.triangles, 0, 8, 8);
	cap(mesh, 0, 8, true);
	cap(mesh, 8, 8, false);
	return mesh;
}

/** Local mesh in metres. The support face is z=0 and the member extends along +z. */
export function jointMeshes(shoe: boolean, r: number, w: number): JointMesh[] {
	// Reserve a tenth of the width for faceting error even on a much wider host.
	const halfStep = Math.atan2(Math.sqrt(0.1 * w * (2 * r + 0.1 * w)), r);
	const steps = Math.max(16, Math.ceil(Math.PI / (2 * halfStep)));
	if (!Number.isSafeInteger(steps) || steps > 65536)
		throw new RangeError('Unresolvable structural contact aspect ratio');
	if (shoe) {
		const plate = band(r, w, 0, 2 * Math.PI, 2 * steps, true);
		return [
			plate,
			pin('dot', w * 0.22, w * 0.15, [r / Math.cos(Math.PI / (2 * steps)) + w * 0.35, 0, w * 0.725])
		];
	}
	const gap = Math.atan2(w * 0.15, r);
	const seat = r / Math.cos((Math.PI - 2 * gap) / (2 * steps)) + w * 0.35;
	return [
		band(r, w, gap, Math.PI - gap, steps, false),
		band(r, w, Math.PI + gap, 2 * Math.PI - gap, steps, false),
		...[-seat, seat].map((x) => pin('bolt', w * 0.14, w * 0.65, [x, 0, w * 0.325]))
	];
}
