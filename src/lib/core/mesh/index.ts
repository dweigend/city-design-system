/** Module: Assembles metric ribbons, bearings and batched indexed meshes. */
import { bounds, size, type Vec3 } from '../geometry';
import { PlaceableObject, type Anchor, type Shape } from '../object';
import { defaults } from '../../../config/mesh';

/** Indexed shape in XYZ meters. */
export type MeshShape = Extract<Shape, { kind: 'mesh' }>;

type Ring = readonly [Vec3, Vec3, Vec3, Vec3];

// Exact arithmetic: the zero-length edge has no directional offset.
function norm(a: Vec3, b: Vec3): readonly [number, number] {
	const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
	return distance ? [(a[1] - b[1]) / distance, (b[0] - a[0]) / distance] : [0, 0];
}

// Exact arithmetic: one corner is half the full deck width from the centerline.
function rim(points: readonly Vec3[], index: number, widthM: number, thicknessM: number): Ring {
	const p = points[index];
	const a = norm(points[Math.max(0, index - 1)], p);
	const b = norm(p, points[Math.min(index + 1, points.length - 1)]);
	const normal = b[0] || b[1] ? b : a;
	const dx = a[0] + b[0];
	const dy = a[1] + b[1];
	const dot = dx * normal[0] + dy * normal[1];
	const half = widthM / 2;
	const offset =
		dot >= 1 / defaults.maximumMiterRatio
			? [(half * dx) / dot, (half * dy) / dot]
			: [half * normal[0], half * normal[1]];
	const [x, y, z] = p;
	const [u, v] = offset;
	return [
		[x + u, y + v, z],
		[x - u, y - v, z],
		[x - u, y - v, z - thicknessM],
		[x + u, y + v, z - thicknessM]
	];
}

// Exact arithmetic: quad triangulation and circular coordinates follow a full turn.
/** Opens a mutable mesh builder for ribbons, piers and indexed geometry. */
export function mesh() {
	const positions: number[] = [];
	const indices: number[] = [];
	const add = (point: Vec3) => {
		const index = positions.length / 3;
		positions.push(...point);
		return index;
	};
	const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d);
	return {
		append(shape: MeshShape) {
			const offset = positions.length / 3;
			for (const value of shape.positions) positions.push(value);
			for (const index of shape.indices) indices.push(index + offset);
		},
		ribbon(points: readonly Vec3[], widthM: number, thicknessM: number) {
			if (points.length < 2) return;
			const rings = points.map((_, i) => rim(points, i, widthM, thicknessM).map(add));
			const [start] = rings;
			quad(start[3], start[2], start[1], start[0]);
			for (let i = 1; i < rings.length; i++) {
				const a = rings[i - 1];
				const b = rings[i];
				for (let j = 0; j < a.length; j++) {
					const next = (j + 1) % a.length;
					quad(a[j], a[next], b[next], b[j]);
				}
			}
			const end = rings[rings.length - 1];
			quad(end[0], end[1], end[2], end[3]);
		},
		pier([x, y, z]: Vec3, topM: number, radiusM: number) {
			if (z >= topM) return;
			const sides = defaults.pierSides;
			const lower: number[] = [];
			const upper: number[] = [];
			for (let i = 0; i < sides; i++) {
				const angle = (i * Math.PI * 2) / sides;
				const u = x + radiusM * Math.cos(angle);
				const v = y + radiusM * Math.sin(angle);
				lower.push(add([u, v, z]));
				upper.push(add([u, v, topM]));
			}
			const cap = add([x, y, topM]);
			for (let i = 0; i < sides; i++) {
				const next = (i + 1) % sides;
				quad(lower[i], lower[next], upper[next], upper[i]);
				indices.push(cap, upper[i], upper[next]);
			}
		},
		shape(): MeshShape | undefined {
			return indices.length ? { kind: 'mesh', positions, indices } : undefined;
		}
	};
}

export type Mesh = ReturnType<typeof mesh>;

/** Freezes nonempty mesh layers as an object and measures their XY footprint in meters. */
// Exact arithmetic: points are XYZ triples and empty geometry spans zero meters.
export function createMeshObject(
	id: string,
	layers: Readonly<Record<string, Mesh>>,
	anchors: readonly Anchor[]
) {
	const parts = Object.entries(layers).flatMap(([slot, layer]) => {
		const shape = layer.shape();
		return shape ? [{ id: slot, slot, shape }] : [];
	});
	const points = parts.flatMap(({ shape }) =>
		Array.from({ length: shape.positions.length / 3 }, (_, i): Vec3 => [
			shape.positions[3 * i],
			shape.positions[3 * i + 1],
			shape.positions[3 * i + 2]
		])
	);
	const extent = bounds(points);
	const [width, depth] = extent ? size(extent) : [0, 0];
	return PlaceableObject.create({
		id,
		slots: Object.keys(layers),
		parts,
		footprint: { width, depth },
		anchors
	});
}

/** Adds a vertical pier and, for an offset bearing, its horizontal crosshead. */
export { drawBearing } from './bearing';

/** Builds one square-profile segment along a metric span. */
export { squareSegment } from './segment';
