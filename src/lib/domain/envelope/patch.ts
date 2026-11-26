import { defaults, settings } from '../../../config/envelope';
import {
	crossProduct,
	displacement,
	dotProduct,
	interpolation,
	length,
	scaled,
	sum,
	unitVector,
	type Vec3
} from '../../core/geometry';
import { createMeshObject, mesh, squareSegment, type MeshShape } from '../../core/mesh';
import {
	clipFraction,
	spanM,
	validateGrips,
	validateMeshTriangles,
	type EnvelopeGrip
} from './grips';

const midpoint = /* Exact arithmetic: halfway along a parametric edge. */ 0.5;
const cornerCount = /* Exact arithmetic: one corner per side of a quadrilateral. */ 4;
const parameterStart = /* Exact arithmetic: boundary parameter at the start. */ 0;
const parameterEnd = /* Exact arithmetic: boundary parameter at the end. */ 1;
const firstIndex = /* Exact arithmetic: zero-based index of the first entry. */ 0;
const halves = /* Exact arithmetic: a symmetric boundary has two halves. */ 2;
const zero = /* Exact arithmetic: zero sag and zero projected triangle area. */ 0;

type Corners<T> = readonly [T, T, T, T];

export type TensionPatchSpec = Readonly<{
	id: string;
	corners: Corners<EnvelopeGrip>;
	edgeGrips?: Corners<EnvelopeGrip | undefined>;
	subdivisions?: number;
	sagRatio?: number;
	tensionRatio?: number;
}>;

function normalOf([a, b, c, d]: Corners<Vec3>) {
	const normal = unitVector(crossProduct(displacement(a, c), displacement(b, d)));
	if (!normal.every(Number.isFinite)) throw new RangeError('Expected finite patch normal');
	return normal;
}

function createEdges(
	points: Corners<Vec3>,
	normal: Vec3,
	midpoints?: Corners<EnvelopeGrip | undefined>
) {
	const edges = points.map((from, index) => {
		const to = points[(index + 1) % points.length];
		const after = points[(index + 2) % points.length];
		const span = spanM(from, to);
		const turn = dotProduct(crossProduct(displacement(from, to), displacement(to, after)), normal);
		if (!Number.isFinite(turn) || turn <= span * defaults.envelopeGripToleranceM)
			throw new RangeError('Patch grips must project to a strictly convex ring');
		const grip = midpoints?.[index];
		const offset = grip
			? displacement(interpolation(from, to, midpoint), grip.position)
			: undefined;
		if (offset && !(length(crossProduct(offset, normal)) <= defaults.envelopeGripToleranceM))
			throw new RangeError('Edge grip must project to its edge midpoint');
		return { span, offset };
	});
	return edges;
}

function bubble(t: number) {
	return (
		/* Exact arithmetic: 4t(1-t) is one at the midpoint and zero at the ends. */ 4 * t * (1 - t)
	);
}

function sampleAt(
	points: Corners<Vec3>,
	edges: ReturnType<typeof createEdges>,
	sag: Vec3,
	u: number,
	v: number
): Vec3 {
	const [a, b, c, d] = points;
	const base = interpolation(interpolation(a, b, u), interpolation(d, c, u), v);
	const weights = [bubble(u) * (1 - v), bubble(v) * u, bubble(u) * v, bubble(v) * (1 - u)];
	return edges.reduce(
		(point, { offset }, i) => (offset ? sum(point, scaled(offset, weights[i])) : point),
		sum(base, scaled(sag, bubble(u) * bubble(v)))
	);
}

function triangulate(points: readonly Vec3[], stride: number, normal: Vec3): MeshShape {
	const indices: number[] = [];
	function triangle(a: number, b: number, c: number) {
		const facing = dotProduct(
			crossProduct(displacement(points[a], points[b]), displacement(points[a], points[c])),
			normal
		);
		if (!Number.isFinite(facing) || facing <= 0)
			throw new RangeError('Patch sampling requires nondegenerate outward triangles');
		indices.push(a, b, c);
	}
	for (let row = firstIndex; row < stride - 1; row++) {
		for (let col = firstIndex; col < stride - 1; col++) {
			const a = row * stride + col;
			const c = a + stride + 1;
			triangle(a, a + 1, c);
			triangle(a, c, a + stride);
		}
	}
	return { kind: 'mesh', positions: points.flat(), indices };
}

function createCuffs(
	spec: TensionPatchSpec,
	edges: ReturnType<typeof createEdges>,
	sample: (u: number, v: number) => Vec3
) {
	const perimeter = [
		(t: number) => sample(t, parameterStart),
		(t: number) => sample(parameterEnd, t),
		(t: number) => sample(parameterEnd - t, parameterEnd),
		(t: number) => sample(parameterStart, parameterEnd - t)
	];
	const clips = mesh();
	for (const [index, at] of perimeter.entries()) {
		const fraction = clipFraction(edges[index].span);
		const ranges = [
			[parameterStart, fraction],
			[parameterEnd - fraction, parameterEnd]
		];
		if (spec.edgeGrips?.[index])
			ranges.push(
				[midpoint - fraction / halves, midpoint],
				[midpoint, midpoint + fraction / halves]
			);
		for (const [from, to] of ranges) {
			const a = at(from);
			const b = at(to);
			spanM(a, b);
			clips.append(validateMeshTriangles(squareSegment(a, b, defaults.membraneCuffWidthM)));
		}
	}
	return clips;
}

function validateSubdivisions(subdivisions: number, hasEdgeGrips: boolean) {
	const { min, max } = settings.membraneSubdivisions.bounds;
	if (
		!Number.isInteger(subdivisions) ||
		subdivisions < min ||
		subdivisions > max ||
		(hasEdgeGrips && subdivisions % halves !== zero)
	)
		throw new RangeError('Invalid membrane subdivisions');
}

function validateRatios(sagRatio: number, tensionRatio: number) {
	const sag = settings.membraneSagRatio.bounds;
	const tension = settings.membraneTensionRatio.bounds;
	if (
		!Number.isFinite(sagRatio) ||
		sagRatio < sag.min ||
		sagRatio > sag.max ||
		!Number.isFinite(tensionRatio) ||
		tensionRatio <= tension.exclusiveMin ||
		tensionRatio > tension.max
	)
		throw new RangeError('Invalid membrane sag or tension');
}

function collectPatchGrips(
	id: string,
	corners: Corners<EnvelopeGrip>,
	edgeGrips?: Corners<EnvelopeGrip | undefined>
): EnvelopeGrip[] {
	if (corners.length !== cornerCount || (edgeGrips && edgeGrips.length !== cornerCount))
		throw new RangeError('Expected four cyclic corners and at most one grip per edge');
	const grips: EnvelopeGrip[] = [...corners];
	for (const grip of edgeGrips ?? []) if (grip !== undefined) grips.push(grip);
	validateGrips(id, grips, cornerCount);
	return grips;
}

/** Spans a convex four-grip survey. Optional edge grips run from each corner to the next. */
export function createTensionPatch(spec: TensionPatchSpec) {
	const {
		id,
		corners,
		edgeGrips,
		subdivisions = defaults.membraneSubdivisions,
		sagRatio = defaults.membraneSagRatio,
		tensionRatio = defaults.membraneTensionRatio
	} = spec;
	const grips = collectPatchGrips(id, corners, edgeGrips);
	validateSubdivisions(subdivisions, grips.length > corners.length);
	validateRatios(sagRatio, tensionRatio);

	const [a, b, c, d] = corners;
	const points = [a.position, b.position, c.position, d.position] as const;
	const normal = normalOf(points);
	const edges = createEdges(points, normal, edgeGrips);
	const shortest = Math.min(...edges.map(({ span }) => span));
	const sag = scaled(normal, (-shortest * sagRatio) / (1 + tensionRatio));
	const sample = (u: number, v: number) => sampleAt(points, edges, sag, u, v);
	const stride = subdivisions + 1;
	const grid: Vec3[] = [];
	for (let row = firstIndex; row < stride; row++)
		for (let col = firstIndex; col < stride; col++)
			grid.push(sample(col / subdivisions, row / subdivisions));
	const membrane = mesh();
	membrane.append(triangulate(grid, stride, normal));
	return createMeshObject(
		id,
		{ membrane, 'envelope-clip': createCuffs(spec, edges, sample) },
		grips.map(({ id: name, position }) => ({ name, position, normal }))
	);
}
