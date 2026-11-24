import { materialSettings } from '../../../config/material';
import type { Vec2 } from '../../core/geometry';
import { cutOpenings } from './cells';
import { readFamily, type Family, type FamilySlot, type PatternParams } from './families';
import {
	readLevelDetail,
	readSurfaceLevelName,
	type SurfaceLevel,
	type SurfaceLevelAlias
} from './levels';
import { dotMarks, estimateMarks, jointSegments, stripeMarks, type PrintFace } from './marks';
import { frameArea, readFrame, type Frame, type Patch } from './patch';
import { createPatternFrame, readFaceMap } from './pattern';
import { addCell, createSink, readIndices, type MeshSink } from './prism';

const {
	patchTrianglesPerSquareM,
	minimumMeshTriangles,
	maxLayoutUnits,
	coarsenStepRatio,
	coarsenStepLimit,
	farMarkPitchM,
	markLiftM,
	pencilLiftM,
	dotSides,
	planeToleranceM
} = materialSettings;

/** Player or page choices for one surface. `moduleScale` is a unitless multiplier of the
 * configured pattern pitch and panel module; `seed` is kept for callers and draws nothing, since a
 * model material is even (MAT-7). */
export type SurfaceOptions = Readonly<{
	seed?: number;
	moduleScale?: number;
	level?: SurfaceLevel | SurfaceLevelAlias;
}>;

/** Meshes by family slot in world meters, joint lines as XYZ endpoint pairs, the triangle count,
 * the level drawn and the pattern scale after coarsening. */
export type SurfaceMesh = Readonly<{
	family: Family;
	level: SurfaceLevel;
	moduleScale: number;
	triangles: number;
	meshes: ReadonlyMap<FamilySlot, Readonly<{ positions: number[]; indices: number[] }>>;
	lines: readonly number[];
}>;

function scaleParams(params: PatternParams, scale: number): PatternParams {
	const scaled = {
		...params,
		pitch: params.pitch * scale,
		joint: [params.joint[0] * scale, params.joint[1] * scale] as const
	};
	if (
		![scaled.pitch, ...scaled.joint].every(Number.isFinite) ||
		(params.pitch > 0 && scaled.pitch <= planeToleranceM)
	)
		throw new RangeError('Scaled surface dimensions must be finite and exceed the plane tolerance');
	return scaled;
}

// Exact arithmetic: neutral defaults.
function readOptions({ moduleScale = 1, level = 'near' }: SurfaceOptions) {
	if (!Number.isFinite(moduleScale) || moduleScale <= 0)
		throw new RangeError('Module scale must be finite and positive');
	return { moduleScale, level: readSurfaceLevelName(level) };
}

// Exact arithmetic: a triangle count cannot be negative.
function readBudget(frame: Frame) {
	const budget = frame.patch.budget ?? patchTrianglesPerSquareM * frameArea(frame);
	if (!Number.isFinite(budget) || budget < 0)
		throw new RangeError('Patch budget must be finite and nonnegative');
	return budget;
}

function printFace(frame: Frame, openings: boolean): PrintFace {
	const body = frame.patch.pattern ?? createPatternFrame([frame.patch]);
	return {
		outline: frame.outline,
		openings: openings ? (frame.patch.openings ?? []) : [],
		map: readFaceMap(frame, body),
		body
	};
}

// Exact arithmetic: the face lies at zero and the backing behind it.
function addFace(sink: MeshSink, frame: Frame, face: PrintFace) {
	const back = frame.patch.backed !== false;
	const base = back ? -frame.patch.thickness : 0;
	for (const cell of cutOpenings(face.outline, face.openings))
		addCell(sink, frame, cell, base, { at: 0 }, back);
}

// Exact arithmetic: a flat mark has its base on its top.
function addMarks(sink: MeshSink, frame: Frame, marks: readonly (readonly Vec2[])[]) {
	for (const mark of marks) addCell(sink, frame, mark, markLiftM, { at: markLiftM }, false);
}

function lines(frame: Frame, segments: readonly (readonly [Vec2, Vec2])[]) {
	return segments.flatMap(([a, b]) => [
		...frame.point(a[0], a[1], pencilLiftM),
		...frame.point(b[0], b[1], pencilLiftM)
	]);
}

function prints(family: Family, params: PatternParams, level: SurfaceLevel) {
	const { marks } = readLevelDetail(level);
	if (readFamily(family).pattern === 'plain' || marks === 'none') return false;
	return marks === 'all' || params.pitch >= farMarkPitchM;
}

/** Whether a level prints the marks of a family at a pattern scale: every pattern near and mid,
 * only a large graphic one (pitch at least `farMarkPitchM`) far, none in pencil. */
// Exact arithmetic: a module scale of one keeps the configured pitch.
export function printsMarks(
	family: Family,
	level: SurfaceLevel | SurfaceLevelAlias,
	moduleScale = 1
): boolean {
	return prints(
		family,
		scaleParams(readFamily(family).params, moduleScale),
		readSurfaceLevelName(level)
	);
}

function marksOf(family: Family, face: PrintFace, params: PatternParams, level: SurfaceLevel) {
	if (!prints(family, params, level)) return [];
	return readFamily(family).pattern === 'stripe'
		? stripeMarks(face, params)
		: dotMarks(face, params);
}

function stripeEdges(family: Family, face: PrintFace, params: PatternParams, level: SurfaceLevel) {
	if (level !== 'pencil' || readFamily(family).pattern !== 'stripe') return [];
	return stripeMarks(face, params).flatMap((mark) =>
		mark.map((a, i) => [a, mark[(i + 1) % mark.length]] as const)
	);
}

function collect(
	family: Family,
	level: SurfaceLevel,
	moduleScale: number,
	sinks: ReadonlyMap<FamilySlot, MeshSink>,
	lineList: readonly number[]
): SurfaceMesh {
	const meshes = new Map<FamilySlot, { positions: number[]; indices: number[] }>();
	let triangles = 0;
	for (const [slot, sink] of sinks) {
		const indices = readIndices(sink);
		if (!indices.length) continue;
		meshes.set(slot, { positions: sink.positions, indices });
		triangles += indices.length / 3;
	}
	return { family, level, moduleScale, triangles, meshes, lines: lineList };
}

// Exact arithmetic: an empty mesh uses zero triangles.
function emptySurface(family: Family, level: SurfaceLevel, moduleScale: number): SurfaceMesh {
	return { family, level, moduleScale, triangles: 0, meshes: new Map(), lines: [] };
}

function buildAt(
	family: Family,
	frame: Frame,
	level: SurfaceLevel,
	scale: number,
	withMarks: boolean
) {
	const detail = readLevelDetail(level);
	const params = scaleParams(readFamily(family).params, scale);
	const face = printFace(frame, detail.openings);
	const sinks = new Map<FamilySlot, MeshSink>([['face', createSink()]]);
	addFace(sinks.get('face') as MeshSink, frame, face);
	if (withMarks) {
		const mark = createSink();
		addMarks(mark, frame, marksOf(family, face, params, level));
		sinks.set('mark', mark);
	}
	const segments = detail.joints ? jointSegments(face, params) : [];
	const edges = withMarks ? stripeEdges(family, face, params, level) : [];
	return collect(family, level, scale, sinks, lines(frame, [...segments, ...edges]));
}

/** The pattern scale at which the marks of the family are expected to fit the patch's triangle
 * budget: the requested scale grown by coarsening steps, at most the step limit. Passing it as
 * `moduleScale` lets `buildSurface` succeed on its first layout. */
// Exact arithmetic: a stripe band is one quad of two triangles, a dot n − 2.
export function fitModuleScale(family: Family, patch: Patch, options: SurfaceOptions = {}): number {
	const frame = readFrame(patch);
	const { pattern, params } = readFamily(family);
	const { moduleScale } = readOptions(options);
	if (pattern === 'plain') return moduleScale;
	const budget = readBudget(frame);
	const area = frameArea(frame);
	const perMark = pattern === 'dots' ? dotSides - 2 : 2;
	let scale = moduleScale;
	for (let step = 0; step < coarsenStepLimit; step++) {
		const estimate = estimateMarks(area, scaleParams(params, scale), pattern === 'dots');
		if (estimate <= maxLayoutUnits && estimate * perMark <= budget) return scale;
		scale *= coarsenStepRatio;
	}
	return scale;
}

/** Builds one family on one patch at a level within its triangle budget (explicit or
 * proportional to the patch area): the face in one tone, cut around the openings the level shows,
 * the printed marks of its pattern in body coordinates (`patch.pattern`, or the patch's own box),
 * and hairline joints as lines. Coarsens the pattern until the marks fit and drops them when they
 * never do. Returns empty geometry when the budget is below the configured minimum or the face
 * alone exceeds it. Throws RangeError for an invalid patch, family, level, scale or budget. */
export function buildSurface(
	family: Family,
	patch: Patch,
	options: SurfaceOptions = {}
): SurfaceMesh {
	const frame = readFrame(patch);
	const { moduleScale, level } = readOptions(options);
	const budget = readBudget(frame);
	if (budget < minimumMeshTriangles) return emptySurface(family, level, moduleScale);
	const { pattern, params } = readFamily(family);
	const area = frameArea(frame);
	let scale = moduleScale;
	for (let step = 0; pattern !== 'plain' && step <= coarsenStepLimit; step++) {
		const estimate = estimateMarks(area, scaleParams(params, scale), pattern === 'dots');
		const mesh =
			estimate <= maxLayoutUnits ? buildAt(family, frame, level, scale, true) : undefined;
		if (mesh && mesh.triangles <= budget) return mesh;
		scale *= coarsenStepRatio;
	}
	const plain = buildAt(family, frame, level, moduleScale, false);
	return plain.triangles <= budget ? plain : emptySurface(family, level, moduleScale);
}
