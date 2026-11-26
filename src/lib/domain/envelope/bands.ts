import { defaults, settings } from '../../../config/envelope';
import {
	interpolation,
	isSegmentIntersection,
	unitVector,
	type Vec2,
	type Vec3
} from '../../core/geometry';
import { createMeshObject, mesh, type Mesh } from '../../core/mesh';
import type { Anchor } from '../../core/object';
import { encodeKey } from '../../core/ref';
import {
	clipFraction,
	spanM,
	validateGrips,
	validateMeshTriangles,
	type EnvelopeGrip
} from './grips';

export type FacadeBandsSpec = Readonly<{
	id: string;
	grips: readonly EnvelopeGrip[];
	bandCount?: number;
	bandHeightM: number;
	pitchM: number;
}>;

const minimumGrips = /* Exact arithmetic: one bay needs two ends. */ 2;
const planZ = /* Exact arithmetic: project the frontage onto XY. */ 0;
const nextBay = /* Exact arithmetic: first bay beyond the shared endpoint. */ 2;
const firstCourse = /* Exact arithmetic: zero-based course index. */ 0;
const centerOffset = /* Exact arithmetic: zero vertical thickness leaves the center unchanged. */ 0;
const ringVertices = /* Exact arithmetic: four profile vertices per ribbon ring. */ 4;
const xyzStride = /* Exact arithmetic: three coordinates per packed vertex. */ 3;
const topSides = /* Exact arithmetic: left and right top edges of each ribbon segment. */ [0, 1];
const { facadeBandDepthM, envelopeClipGrowthM } = defaults;

function validateFrontage(grips: readonly EnvelopeGrip[]) {
	const points = grips.map(({ position: [x, y] }): Vec2 => [x, y]);
	const bays = points.slice(1).map(([x, y], i) => {
		const [a, b] = points[i];
		const span = spanM([a, b, planZ], [x, y, planZ]);
		const normal = unitVector([y - b, a - x, planZ]);
		return { span, normal };
	});
	for (const [i, a] of points.slice(0, -1).entries()) {
		const b = points[i + 1];
		const next = points[i + nextBay];
		if (next && (isSegmentIntersection(a, b, next, next) || isSegmentIntersection(b, next, a, a)))
			throw new RangeError('Frontage must not retrace a bay');
		for (let j = i + nextBay; j < bays.length; j++) {
			if (isSegmentIntersection(a, b, points[j], points[j + 1]))
				throw new RangeError('Frontage bays must not intersect');
		}
	}
	return bays;
}

function validateCourses(bandCount: number, bandHeightM: number, pitchM: number) {
	if (
		!Number.isSafeInteger(bandCount) ||
		bandCount < settings.facadeBandCount.bounds.min ||
		bandCount > settings.facadeBandCount.bounds.max ||
		!Number.isFinite(bandHeightM) ||
		bandHeightM <= 0 ||
		!Number.isFinite(pitchM) ||
		pitchM <= bandHeightM + envelopeClipGrowthM
	)
		throw new RangeError('Expected positive facade courses with a clear opening between cuffs');
}

function appendValidatedRibbon(
	target: Mesh,
	points: readonly Vec3[],
	widthM: number,
	thicknessM: number
) {
	const built = mesh();
	built.ribbon(points, widthM, thicknessM);
	const shape = validateMeshTriangles(built.shape());
	for (let i = 0; i < points.length - 1; i++) {
		const dx = points[i + 1][0] - points[i][0];
		const dy = points[i + 1][1] - points[i][1];
		for (const side of topSides) {
			const a = (i * ringVertices + side) * xyzStride;
			const b = ((i + 1) * ringVertices + side) * xyzStride;
			if (
				(shape.positions[b] - shape.positions[a]) * dx +
					(shape.positions[b + 1] - shape.positions[a + 1]) * dy <=
				0
			)
				throw new RangeError('Envelope frontage turns too tightly for its profile width');
		}
	}
	target.append(shape);
}

function cuffPaths(grips: readonly EnvelopeGrip[], bays: readonly { span: number }[]) {
	const fractions = bays.map(({ span }) => clipFraction(span));
	return grips.map(({ position }, i): readonly Vec3[] => {
		const before =
			i > 0 ? interpolation(grips[i - 1].position, position, 1 - fractions[i - 1]) : undefined;
		const after =
			i < bays.length ? interpolation(position, grips[i + 1].position, fractions[i]) : undefined;
		return [...(before ? [before] : []), position, ...(after ? [after] : [])];
	});
}

function createAnchors(
	grips: readonly EnvelopeGrip[],
	bays: readonly { normal: Vec3 }[],
	bandCount: number,
	atHeight: (point: Vec3, course: number, thickness: number) => Vec3
) {
	const anchors: Anchor[] = [];
	for (const [i, { normal }] of bays.entries()) {
		const from = grips[i];
		const to = grips[i + 1];
		for (let course = firstCourse; course < bandCount; course++) {
			for (const grip of [from, to]) {
				anchors.push({
					name: encodeKey([from.id, to.id, course, grip.id]),
					position: atHeight(grip.position, course, centerOffset),
					normal
				});
			}
		}
	}
	return anchors;
}

/** The grip height is the center of the first course. Fronts face to the right of bay order. */
export function createFacadeBands({
	id,
	grips,
	bandCount = defaults.facadeBandCount,
	bandHeightM,
	pitchM
}: FacadeBandsSpec) {
	validateGrips(id, grips, minimumGrips);
	validateCourses(bandCount, bandHeightM, pitchM);

	const bays = validateFrontage(grips);
	const bands = mesh();
	const clips = mesh();
	const cuffs = cuffPaths(grips, bays);
	const clipWidthM = facadeBandDepthM + envelopeClipGrowthM;
	const clipHeightM = bandHeightM + envelopeClipGrowthM;
	const atHeight = ([x, y, z]: Vec3, course: number, thickness: number): Vec3 => [
		x,
		y,
		z + course * pitchM + thickness / 2
	];
	for (let course = firstCourse; course < bandCount; course++) {
		appendValidatedRibbon(
			bands,
			grips.map(({ position }) => atHeight(position, course, bandHeightM)),
			facadeBandDepthM,
			bandHeightM
		);
		for (const path of cuffs) {
			appendValidatedRibbon(
				clips,
				path.map((point) => atHeight(point, course, clipHeightM)),
				clipWidthM,
				clipHeightM
			);
		}
	}
	return createMeshObject(
		id,
		{ 'envelope-band': bands, 'envelope-clip': clips },
		createAnchors(grips, bays, bandCount, atHeight)
	);
}
