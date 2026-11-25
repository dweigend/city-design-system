import { defaults } from '../../../config/valley-projection';
import { sum, scaled, type Vec3 } from '../../core/geometry';
import { channelPolygons, type Valley } from '../../domain/valley';
import type { ReachFrame } from './frame';
import { waterUnion, type WaterFace } from './water-union';

type Polygon = readonly Vec3[];

export type Mesh = { kind: 'mesh'; positions: number[]; indices: number[] };

export function mesh(): Mesh {
	return { kind: 'mesh', positions: [], indices: [] };
}

function clip(polygon: Polygon, axis: 0 | 1, bound: number, side: number): Polygon {
	const result: Vec3[] = [];
	for (let i = 0; i < polygon.length; i++) {
		const a = polygon[i];
		const b = polygon[(i + 1) % polygon.length];
		const inside = side * (a[axis] - bound) <= 0;
		if (inside) result.push(a);
		if (inside === side * (b[axis] - bound) <= 0) continue;
		const t = (bound - a[axis]) / (b[axis] - a[axis]);
		result.push([
			axis === 0 ? bound : a[0] + (b[0] - a[0]) * t,
			axis === 1 ? bound : a[1] + (b[1] - a[1]) * t,
			a[2] + (b[2] - a[2]) * t
		]);
	}
	return result;
}

function clipWindow(polygon: Polygon, x: number, y: number): Polygon {
	const along = /* Exact arithmetic: X coordinate index. */ 0;
	const across = /* Exact arithmetic: Y coordinate index. */ 1;
	const low = /* Exact arithmetic: outward sign at the low bound. */ -1;
	const high = /* Exact arithmetic: outward sign at the high bound. */ 1;
	return clip(
		clip(clip(clip(polygon, along, -x, low), along, x, high), across, -y, low),
		across,
		y,
		high
	);
}

function weld(surface: Mesh) {
	const byPosition = new Map<string, number>();
	return (p: Vec3) => {
		const key = p.map((v) => Math.round(v * defaults.valleyWaterWeldPerM)).join(',');
		const previous = byPosition.get(key);
		if (previous !== undefined) return previous;
		const index = surface.positions.length / 3;
		surface.positions.push(...p);
		byPosition.set(key, index);
		return index;
	};
}

export function waterSurface(valley: Valley, frame: ReachFrame, width: number, scale: number) {
	const surface = mesh();
	const point = weld(surface);
	const polygons: Polygon[] = [];
	const union = waterUnion();
	const append = ({ polygon, split }: WaterFace) => {
		const indices = polygon.map(point);
		// A fan from a boundary vertex can skip collinear seam edges. Use an interior fan
		// for pieces with split edges so every inserted vertex reaches the mesh.
		const a = split
			? polygon.reduce<Vec3>(
					(total, p) => sum(total, scaled(p, 1 / polygon.length)),
					/* Exact arithmetic: the sum begins at the origin. */ [0, 0, 0]
				)
			: polygon[0];
		const first = split ? point(a) : indices[0];
		for (let i = split ? 0 : 1; i < (split ? polygon.length : polygon.length - 1); i++) {
			const next = (i + 1) % polygon.length;
			const [b, c] = [polygon[i], polygon[next]];
			if (first === indices[i] || indices[i] === indices[next] || first === indices[next]) continue;
			const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
			if (Math.abs(area) < defaults.valleyWaterTriangleArea2ToleranceM2) continue;
			if (area > 0) surface.indices.push(first, indices[i], indices[next]);
			else surface.indices.push(first, indices[next], indices[i]);
		}
		polygons.push(polygon);
	};
	const add = (world: Polygon) => {
		const local = world.map(([x, y, z]): Vec3 => [...frame.toLocal(x, y), z * scale]);
		for (const part of union(clipWindow(local, frame.length / 2, width / 2))) append(part);
	};
	for (const { vertices, indices, level } of valley.lakes) {
		for (let i = 0; i < indices.length; i += 3) {
			add([indices[i], indices[i + 1], indices[i + 2]].map((index) => [...vertices[index], level]));
		}
	}
	const trunk = valley.reaches.filter(({ trunk }) => trunk);
	const tributaries = valley.reaches.filter(({ trunk }) => !trunk);
	for (const polygon of channelPolygons(trunk)) add(polygon);
	for (const polygon of channelPolygons(tributaries)) add(polygon);
	return { surface, polygons };
}

export type SectionPoint = { x: number; y: number; z: number; water: number; bankSide: -1 | 0 | 1 };

export function waterSections(sides: readonly (readonly SectionPoint[])[]): Mesh {
	const result = mesh();
	for (const side of sides) {
		for (let i = 1; i < side.length; i++) {
			const [a, b] = [side[i - 1], side[i]];
			if (a.water < a.z || b.water < b.z || (a.water === a.z && b.water === b.z)) continue;
			const start = result.positions.length / 3;
			result.positions.push(a.x, a.y, a.water, a.x, a.y, a.z, b.x, b.y, b.water, b.x, b.y, b.z);
			const far = start + /* Exact arithmetic: the fourth vertex completes the quad. */ 3;
			result.indices.push(
				start,
				start + 1,
				start + /* Exact arithmetic: second pair. */ 2,
				start + /* Exact arithmetic: second pair. */ 2,
				start + 1,
				far
			);
		}
	}
	return result;
}
