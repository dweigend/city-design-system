import type { Vec3 } from '../traeger';
import type { JointMesh } from './geometry';

function cross([x, y, z]: Vec3, [u, v, w]: Vec3): Vec3 {
	return [y * w - z * v, z * u - x * w, x * v - y * u];
}

function dot(a: Vec3, b: Vec3) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Normalizes a finite direction without overflow or underflow and canonicalizes signed zero. */
export function unit(v: Vec3): Vec3 {
	const scale = Math.max(...v.map(Math.abs));
	if (!Number.isFinite(scale) || scale === 0)
		throw new RangeError('Expected a finite seat direction');
	const [x, y, z] = v.map((n) => n / scale);
	const length = Math.hypot(x, y, z);
	return [x / length || 0, y / length || 0, z / length || 0];
}

/** Constructs the local X axis perpendicular to the normalized member axis. */
export function seatTangent(axis: Vec3): Vec3 {
	return unit(cross(Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1], axis));
}

// At least 1:8 normal advance, bounding the axial travel at grazing incidence.
const minimumRise = 1 / 8;
const precision = 1e-6; // Maximum permitted Float32 seating error, metres.
const bits = new Uint32Array(1);
const floats = new Float32Array(bits.buffer);

function roundUp(value: number) {
	floats[0] = value;
	if (floats[0] < value) {
		if (floats[0] === 0) bits[0] = 1;
		else bits[0] += floats[0] > 0 ? 1 : -1;
	}
	return floats[0] || 0;
}

function fitPlane(mesh: JointMesh, axis: Vec3, tangent: Vec3, normal: Vec3, offset: number) {
	const rise = dot(axis, normal);
	const dx = dot(normal, tangent),
		dy = dot(normal, cross(axis, tangent));
	for (const p of mesh.points) {
		// Round radially outwards before fitting the actual Float32 underside.
		const x = p[0] * (1 + 2 ** -23),
			y = p[1] * (1 + 2 ** -23);
		const u = Math.fround(x) || 0,
			v = Math.fround(y) || 0;
		const height = p[2] + (offset - dx * u - dy * v) / rise;
		const z = roundUp(height);
		if (
			![u, v, height, z].every(Number.isFinite) ||
			Math.max(Math.abs(z - height) * rise, Math.abs(u - p[0]), Math.abs(v - p[1])) > precision
		)
			throw new RangeError('Seat exceeds Float32 fitting precision');
		p[0] = u;
		p[1] = v;
		p[2] = z;
	}
}

/** Seats the meshes on the surveyed plane or the two exterior tangents of a circular support. */
export function fitSeat(
	meshes: JointMesh[],
	axis: Vec3,
	normal: Vec3,
	width: number,
	radius: number,
	memberRadius: number,
	roundAxis?: Vec3
): Vec3 {
	const rise = dot(axis, normal);
	if (rise < minimumRise)
		throw new RangeError('Seat angle too shallow: normal advance must be at least 1/8');
	if (!roundAxis) {
		const tangent = seatTangent(axis);
		for (const mesh of meshes) fitPlane(mesh, axis, tangent, normal, 0);
		return tangent;
	}
	const along = unit(roundAxis);
	if (Math.abs(dot(along, normal)) > 1e-10)
		throw new RangeError('Round support axis must follow the surveyed tangent plane');
	const side = unit(cross(along, normal));
	// Split across the generator so that both jaws span the contact line. Tilt each bearing
	// face onto its own flank. Limit the tilt by both diameters and the available band width.
	const tangent = unit(cross(axis, along));
	const angle = 0.1 * rise * Math.min(1, width / radius, width / memberRadius);
	const sin = Math.sin(angle),
		cos = Math.cos(angle);
	// The cylinder centre is -radius * normal. Its support function in the tilted
	// direction is R*(1-cos(angle)); the half-angle form avoids cancellation.
	const offset = 2 * radius * Math.sin(angle / 2) ** 2;
	let flank = 1;
	for (const mesh of meshes) {
		if (mesh.feature === 'jaw') {
			const face = normal.map((n, i) => n * cos + flank * side[i] * sin) as Vec3;
			fitPlane(mesh, axis, tangent, face, offset);
			flank = -flank;
		} else fitPlane(mesh, axis, tangent, normal, 0);
	}
	return tangent;
}
