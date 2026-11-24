import { materialSettings } from '../../../config/material';
import type { Vec3 } from '../../core/geometry';
import { Random } from '../../core/random';
import { clipToOutline, cutOpenings } from './cells';
import { jointLines } from './lines';
import { readFamily, type Family, type FamilySlot } from './families';
import { estimateUnits, layouts, type ReliefParams } from './layouts';
import { frameArea, readFrame, type Frame, type Patch } from './patch';
import { addCell, createSink, readIndices, type MeshSink, type Unit } from './prism';
import { addCastShadow, addShade } from './shade';

const {
	patchTrianglesPerSquareM,
	minimumMeshTriangles,
	maxLayoutUnits,
	coarsenStepRatio,
	coarsenStepLimit,
	reliefTrianglesPerUnit,
	pencilLiftM,
	planeToleranceM
} = materialSettings;

/** Drawing detail of a surface: raised units, one flat slab in the unit tone, or a flat slab
 * with the joints drawn as pencil lines. */
export type SurfaceLevel = 'relief' | 'flat' | 'pencil';
/** Surface levels from most to least detail. */
export const surfaceLevels = Object.freeze(['relief', 'flat', 'pencil'] as const);

/** Player or page choices for one surface. Scales are unitless multipliers of the configured
 * module and relief; the seed draws unit variants and face depths. `light` is the direction light
 * travels in world axes; with it, level unit tops cast hard shade into the `shade` slot. */
export type SurfaceOptions = Readonly<{
	light?: Vec3;
	seed?: number;
	moduleScale?: number;
	reliefScale?: number;
	level?: SurfaceLevel;
}>;

/** Meshes by family slot in world meters, pencil joint lines as XYZ endpoint pairs, the
 * triangle count, the level actually drawn and the module scale after coarsening. */
export type SurfaceMesh = Readonly<{
	family: Family;
	level: SurfaceLevel;
	moduleScale: number;
	triangles: number;
	meshes: ReadonlyMap<FamilySlot, Readonly<{ positions: number[]; indices: number[] }>>;
	lines: readonly number[];
}>;

function scaleParams(params: ReliefParams, moduleScale: number, reliefScale: number): ReliefParams {
	const scaled: ReliefParams = {
		...params,
		module: [params.module[0] * moduleScale, params.module[1] * moduleScale],
		joint: params.joint * moduleScale,
		relief: params.relief.map((depth) => depth * reliefScale)
	};
	if (
		scaled.module.some((extent) => !Number.isFinite(extent) || extent <= planeToleranceM) ||
		![scaled.joint, ...scaled.relief].every(Number.isFinite)
	)
		throw new RangeError(
			'Scaled surface dimensions must be finite and modules must exceed the plane tolerance'
		);
	return scaled;
}

function seeded(family: Family, seed: number) {
	return Random.create({ seed }).derive(family);
}

function addUnits(sinks: Map<FamilySlot, MeshSink>, frame: Frame, units: readonly Unit[]) {
	const openings = frame.patch.openings ?? [];
	for (const { slot, polygon, base, top } of units) {
		const clipped = clipToOutline(polygon, frame.outline);
		if (!clipped.length) continue;
		const sink = sinks.get(slot as FamilySlot) ?? createSink();
		sinks.set(slot as FamilySlot, sink);
		for (const cell of cutOpenings(clipped, openings)) addCell(sink, frame, cell, base, top, false);
	}
}

function addSlab(sinks: Map<FamilySlot, MeshSink>, frame: Frame, slot: FamilySlot, top: number) {
	const sink = sinks.get(slot) ?? createSink();
	sinks.set(slot, sink);
	const base = -frame.patch.thickness;
	for (const cell of cutOpenings(frame.outline, frame.patch.openings ?? []))
		addCell(sink, frame, cell, base, { at: top }, true);
}

function collect(
	family: Family,
	level: SurfaceLevel,
	moduleScale: number,
	sinks: Map<FamilySlot, MeshSink>,
	lines: number[]
): SurfaceMesh {
	const meshes = new Map<FamilySlot, { positions: number[]; indices: number[] }>();
	let triangles = 0;
	for (const slot of readFamily(family).slots) {
		const sink = sinks.get(slot);
		const indices = sink ? readIndices(sink) : [];
		if (!sink || !indices.length) continue;
		meshes.set(slot, { positions: sink.positions, indices });
		triangles += indices.length / 3;
	}
	return { family, level, moduleScale, triangles, meshes, lines };
}

function buildFlat(family: Family, frame: Frame, face: number, level: SurfaceLevel, scale: number) {
	const sinks = new Map<FamilySlot, MeshSink>();
	addSlab(sinks, frame, 'unit', face);
	return collect(family, level, scale, sinks, []);
}

// Exact arithmetic: an empty mesh uses zero triangles.
function emptySurface(family: Family, level: SurfaceLevel, moduleScale: number): SurfaceMesh {
	return { family, level, moduleScale, triangles: 0, meshes: new Map(), lines: [] };
}

// Exact arithmetic: the backing plane lies at zero.
function buildRelief(
	family: Family,
	frame: Frame,
	units: readonly Unit[],
	scale: number,
	light?: Vec3
) {
	const sinks = new Map<FamilySlot, MeshSink>();
	addSlab(sinks, frame, 'joint', 0);
	addUnits(sinks, frame, units);
	const shade = { joint: createSink(), unit: createSink() };
	if (light)
		for (const unit of units)
			addShade(unit.castOnto ? shade.unit : shade.joint, frame, unit, light);
	for (const shadow of frame.patch.shadows ?? []) addCastShadow(shade, frame, shadow, units);
	sinks.set('shade', shade.joint);
	sinks.set('shade-unit', shade.unit);
	return collect(family, 'relief', scale, sinks, []);
}

// Exact arithmetic: neutral defaults.
function readOptions({
	seed = 1,
	moduleScale = 1,
	reliefScale = 1,
	level = 'relief'
}: SurfaceOptions) {
	if (
		!Number.isFinite(moduleScale) ||
		moduleScale <= 0 ||
		!Number.isFinite(reliefScale) ||
		reliefScale < 0
	)
		throw new RangeError(
			'Module scale must be finite and positive, relief scale finite and nonnegative'
		);
	return { seed, moduleScale, reliefScale, level };
}

// Exact arithmetic: a triangle count cannot be negative.
function readBudget(frame: Frame) {
	const budget = frame.patch.budget ?? patchTrianglesPerSquareM * frameArea(frame);
	if (!Number.isFinite(budget) || budget < 0)
		throw new RangeError('Patch budget must be finite and nonnegative');
	return budget;
}

/** Builds one patch within its triangle budget (explicit or proportional to patch area).
 * Coarsens layouts before generating units and falls back to a slab when detail does not fit.
 * Returns empty geometry when the budget is below the configured minimum or the slab exceeds it.
 * Throws RangeError for an invalid patch, family, scale or budget. */
// Exact arithmetic: a rectangular unit top uses two triangles.
export function buildSurface(
	family: Family,
	patch: Patch,
	options: SurfaceOptions = {}
): SurfaceMesh {
	const frame = readFrame(patch);
	const { layout, params } = readFamily(family);
	const { seed, moduleScale, reliefScale, level } = readOptions(options);
	const budget = readBudget(frame);
	let scale = moduleScale;
	let scaled = scaleParams(params, scale, reliefScale);
	const flatLevel = level === 'relief' ? 'flat' : level;
	if (budget < minimumMeshTriangles) return emptySurface(family, flatLevel, scale);
	const face = Math.max(...scaled.relief);
	const slab = (drawn: SurfaceLevel) => {
		const mesh = buildFlat(family, frame, face, drawn, scale);
		return mesh.triangles <= budget ? mesh : emptySurface(family, drawn, scale);
	};
	if (level === 'flat') return slab(level);
	const unitLimit = Math.min(maxLayoutUnits, budget / 2);
	const layoutUnits = () => layouts[layout](scaled, patch.size, seeded(family, seed));
	const tryDetail = () => {
		const estimate = estimateUnits(layout, scaled, patch.size);
		if (!Number.isFinite(estimate) || estimate > unitLimit) return;
		if (level === 'pencil') {
			const mesh = slab(level);
			if (!mesh.triangles) return mesh;
			return { ...mesh, lines: jointLines(frame, layoutUnits(), face + pencilLiftM) };
		}
		const mesh = buildRelief(family, frame, layoutUnits(), scale, options.light);
		if (mesh.triangles <= budget) return mesh;
	};
	for (let step = 0; step <= coarsenStepLimit; step++) {
		const mesh = tryDetail();
		if (mesh) return mesh;
		const next = scale * coarsenStepRatio;
		if (step === coarsenStepLimit || !Number.isFinite(next)) break;
		scale = next;
		scaled = scaleParams(params, scale, reliefScale);
	}
	return slab('flat');
}

/** The module scale at which a relief of the family is expected to fit the patch's triangle
 * budget: the requested scale grown by coarsening steps until the estimated units times the relief
 * triangles per unit fit, at most the step limit. Passing it as `moduleScale` lets `buildSurface`
 * succeed on its first layout instead of building and discarding finer ones. */
export function fitModuleScale(family: Family, patch: Patch, options: SurfaceOptions = {}): number {
	const frame = readFrame(patch);
	const { layout, params } = readFamily(family);
	const { moduleScale, reliefScale } = readOptions(options);
	const budget = readBudget(frame);
	let scale = moduleScale;
	for (let step = 0; step < coarsenStepLimit; step++) {
		const estimate = estimateUnits(layout, scaleParams(params, scale, reliefScale), patch.size);
		if (Number.isFinite(estimate) && estimate * reliefTrianglesPerUnit <= budget) return scale;
		scale *= coarsenStepRatio;
	}
	return scale;
}
