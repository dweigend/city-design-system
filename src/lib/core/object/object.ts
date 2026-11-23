import { defaults } from '../../../config/object';
import * as geometry from '../geometry';
import type { Bounds3, Vec2, Vec3 } from '../geometry';

const { unitNormalLengthToleranceRatio } = defaults;

/** Metric geometry in XY ground and Z up. Prism rings close implicitly; indices form triangles. */
export type Shape =
	| Readonly<{ kind: 'box'; center: Vec3; size: Vec3; rotation: number }>
	| Readonly<{ kind: 'prism'; polygon: readonly Vec2[]; base: number; top: number }>
	| Readonly<{ kind: 'mesh'; positions: readonly number[]; indices: readonly number[] }>;
/** One shape with an object-local identity and a named slot. */
export type Part = Readonly<{ id: string; slot: string; shape: Shape }>;
/** A named attachment in meters with a unitless outward direction. */
export type Anchor = Readonly<{ name: string; position: Vec3; normal: Vec3 }>;
/** Ground dimensions in meters along the object's local axes. */
export type Footprint = Readonly<{ width: number; depth: number }>;
/** Placeable geometry with ordered slots, parts and anchors. */
export type PlaceableObject = Readonly<{
	id: string;
	slots: readonly string[];
	parts: readonly Part[];
	footprint: Footprint;
	anchors: readonly Anchor[];
}>;

function create({ id, slots, parts, footprint, anchors }: PlaceableObject): PlaceableObject {
	const declared = new Set(slots);
	const partIds = new Set<string>();
	const { width, depth } = footprint;
	finite(width);
	finite(depth);
	if (width < 0 || depth < 0) throw new RangeError('Footprint dimensions must be nonnegative');
	return Object.freeze({
		id,
		slots: Object.freeze([...slots]),
		parts: Object.freeze(
			Array.from(parts, ({ id, slot, shape }) => {
				if (partIds.has(id)) throw new RangeError(`Duplicate part id "${id}"`);
				if (!declared.has(slot)) throw new RangeError(`Undeclared part slot "${slot}"`);
				partIds.add(id);
				return Object.freeze({ id, slot, shape: copyShape(shape) });
			})
		),
		footprint: Object.freeze({ width, depth }),
		anchors: Object.freeze(Array.from(anchors, copyAnchor))
	});
}
/** Creates detached, deeply frozen metric geometry in input order. Invalid fields throw
 * RangeError for numeric or contract violations and TypeError for unknown shapes.
 */
export const PlaceableObject = Object.freeze({ create });

/** Returns detached world bounds of the parts in meters. Throws RangeError for an empty object. */
export function bounds(object: PlaceableObject): Bounds3 {
	const result = geometry.bounds(object.parts.flatMap(({ shape }) => boundsPoints(shape)));
	if (!result) throw new RangeError('Cannot bound an object without parts');
	return result;
}

/** Rotates about the world Z axis in radians, then translates in meters. Returns a detached,
 * frozen object with the same identity, order and local footprint. Normals only rotate.
 * Non-finite motion or resulting coordinates throw RangeError.
 */
export function move(object: PlaceableObject, translation: Vec3, radians: number): PlaceableObject {
	for (const value of [...translation, radians]) finite(value);
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const rotate = ([x, y, z]: Vec3): Vec3 => [x * cos - y * sin, x * sin + y * cos, z];
	const point = (position: Vec3) => geometry.sum(rotate(position), translation);
	return create({
		...object,
		parts: object.parts.map((part) => ({ ...part, shape: moveShape(part.shape, point, radians) })),
		anchors: object.anchors.map(({ name, position, normal }) => ({
			name,
			position: point(position),
			normal: rotate(normal)
		}))
	});
}

function finite(value: number): number {
	if (!Number.isFinite(value)) throw new RangeError('Expected finite numbers');
	return value;
}

function copyCoordinates<T extends readonly number[]>(values: T): T {
	return Object.freeze(Array.from(values, finite)) as T;
}

function copyAnchor({ name, position, normal }: Anchor): Anchor {
	const direction = copyCoordinates(normal);
	if (Math.abs(geometry.length(direction) - 1) > unitNormalLengthToleranceRatio)
		throw new RangeError(`Anchor "${name}" requires a unit normal`);
	return Object.freeze({ name, position: copyCoordinates(position), normal: direction });
}

// Exact arithmetic: each mesh position has one component per axis.
const coordinateStride = 3;
// Exact arithmetic: each mesh face is a triangle with three indices.
const triangleVertexCount = 3;

function copyMesh({ positions, indices }: Extract<Shape, { kind: 'mesh' }>): Shape {
	const vertexCount = positions.length / coordinateStride;
	if (
		positions.length % coordinateStride ||
		!indices.length ||
		indices.length % triangleVertexCount
	)
		throw new RangeError('Mesh requires XYZ positions and nonempty index triples');
	const triangles = [...indices];
	const isVertexIndex = (index: number) =>
		Number.isInteger(index) && index >= 0 && index < vertexCount;
	if (!triangles.every(isVertexIndex))
		throw new RangeError('Mesh index is outside its vertex array');
	for (let offset = 0; offset < triangles.length; offset += triangleVertexCount) {
		const [a, b, c] = [triangles[offset], triangles[offset + 1], triangles[offset + 2]];
		if (a === b || b === c || a === c) throw new RangeError('Mesh triangle repeats a vertex index');
	}
	const points = copyCoordinates(positions);
	return Object.freeze({ kind: 'mesh', positions: points, indices: Object.freeze(triangles) });
}

function copyShape(shape: Shape): Shape {
	switch (shape.kind) {
		case 'box': {
			const { kind, rotation } = shape;
			const center = copyCoordinates(shape.center);
			const size = copyCoordinates(shape.size);
			finite(rotation);
			if (size.some((extent) => extent < 0)) throw new RangeError('Box size must be nonnegative');
			return Object.freeze({ kind, center, size, rotation });
		}
		case 'prism': {
			const { kind, base, top } = shape;
			const polygon = Array.from(shape.polygon, copyCoordinates);
			finite(base);
			finite(top);
			if (polygon.length < triangleVertexCount || top < base)
				throw new RangeError('Invalid prism polygon or heights');
			return Object.freeze({ kind, polygon: Object.freeze(polygon), base, top });
		}
		case 'mesh':
			return copyMesh(shape);
		default:
			throw new TypeError('Unknown object shape');
	}
}

type PointTransform = (point: Vec3) => Vec3;

function vertex(positions: readonly number[], index: number): Vec3 {
	const offset = index * coordinateStride;
	return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function boundsPoints(shape: Shape): Vec3[] {
	switch (shape.kind) {
		case 'box': {
			const [width, depth, height] = shape.size;
			const cos = Math.abs(Math.cos(shape.rotation));
			const sin = Math.abs(Math.sin(shape.rotation));
			const x = cos * (width / 2) + sin * (depth / 2);
			const y = sin * (width / 2) + cos * (depth / 2);
			const extent: Vec3 = [x, y, height / 2];
			return [geometry.displacement(extent, shape.center), geometry.sum(shape.center, extent)];
		}
		case 'prism': {
			const points = shape.polygon.map(([x, y]): Vec3 => [x, y, shape.base]);
			points.push([...shape.polygon[0], shape.top]);
			return points;
		}
		case 'mesh':
			return shape.indices.map((index) => vertex(shape.positions, index));
	}
}

// Exact arithmetic: rotation about Z lets the prism footprint and height be moved independently.
const axisOrigin = 0;

function moveShape(shape: Shape, point: PointTransform, radians: number): Shape {
	switch (shape.kind) {
		case 'box':
			return { ...shape, center: point(shape.center), rotation: shape.rotation + radians };
		case 'prism':
			return {
				kind: 'prism',
				polygon: shape.polygon.map(([x, y]) => {
					const [movedX, movedY] = point([x, y, axisOrigin]);
					return [movedX, movedY];
				}),
				base: point([axisOrigin, axisOrigin, shape.base])[2],
				top: point([axisOrigin, axisOrigin, shape.top])[2]
			};
		case 'mesh': {
			const positions: number[] = [];
			for (let index = 0; index < shape.positions.length / coordinateStride; index += 1)
				positions.push(...point(vertex(shape.positions, index)));
			return { ...shape, positions };
		}
	}
}
