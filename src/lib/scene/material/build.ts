import { materialSettings } from '../../../config/material';
import { dotProduct, type Vec2, type Vec3 } from '../../core/geometry';
import { Random } from '../../core/random';
import { clipToOutline, cutOpenings } from './cells';
import { jointLines } from './lines';
import { readFamily, type Family, type FamilySlot } from './families';
import { layouts, type ReliefParams } from './layouts';
import { readFrame, readPatchArea, type Frame, type Patch } from './patch';
import { addCell, createSink, readIndices, type MeshSink, type Unit } from './prism';

const {
	patchTrianglesPerSquareM,
	coarsenStepRatio,
	coarsenStepLimit,
	pencilLiftM,
	planeToleranceM,
	shadeLiftM
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
	return {
		...params,
		module: [params.module[0] * moduleScale, params.module[1] * moduleScale],
		joint: params.joint * moduleScale,
		relief: params.relief.map((depth) => depth * reliefScale)
	};
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

/** The hard shade a level unit casts onto its `castOnto` plane: its outline moved along the
 * light, minus the unit's own bounding rectangle, lifted just above the plane it falls on. */
function addShade(sink: MeshSink, frame: Frame, unit: Unit, light: Vec3) {
	const { polygon, base, top, castOnto = base } = unit;
	const facing = dotProduct(light, frame.patch.normal);
	const rise = top.at - castOnto;
	if (top.perU || top.perV || facing >= 0 || rise <= planeToleranceM) return;
	const reach = -rise / facing;
	const [du, dv] = [
		reach * dotProduct(light, frame.patch.across),
		reach * dotProduct(light, frame.up)
	];
	const clipped = clipToOutline(polygon, frame.outline);
	if (!clipped.length) return;
	const us = clipped.map(([u]) => u);
	const vs = clipped.map(([, v]) => v);
	const own = [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)] as const;
	const moved = clipToOutline(
		clipped.map(([u, v]): Vec2 => [u + du, v + dv]),
		frame.outline
	);
	if (!moved.length) return;
	const at = castOnto + shadeLiftM;
	for (const cell of cutOpenings(moved, [own, ...(frame.patch.openings ?? [])]))
		addCell(sink, frame, cell, at, { at }, false);
}

/** Shade that another body casts onto the patch: on the backing between units and on every
 * level unit top it covers. */
function addCastShadow(
	sinks: Readonly<Record<'joint' | 'unit', MeshSink>>,
	frame: Frame,
	shadow: readonly Vec2[],
	units: readonly Unit[]
) {
	const openings = frame.patch.openings ?? [];
	const place = (polygon: readonly Vec2[], at: number, sink: MeshSink) => {
		const clipped = clipToOutline(clipToOutline(polygon, frame.outline), shadow);
		if (!clipped.length) return;
		for (const cell of cutOpenings(clipped, openings))
			addCell(sink, frame, cell, at, { at }, false);
	};
	place(frame.outline, shadeLiftM, sinks.joint);
	for (const { polygon, top } of units)
		if (!top.perU && !top.perV) place(polygon, top.at + shadeLiftM, sinks.unit);
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

function buildFlat(
	family: Family,
	frame: Frame,
	units: readonly Unit[],
	params: ReliefParams,
	level: SurfaceLevel,
	moduleScale: number
) {
	const sinks = new Map<FamilySlot, MeshSink>();
	const face = Math.max(...params.relief);
	addSlab(sinks, frame, 'unit', face);
	const lines = level === 'pencil' ? jointLines(frame, units, face + pencilLiftM) : [];
	return collect(family, level, moduleScale, sinks, lines);
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
	if (!(moduleScale > 0) || !(reliefScale >= 0))
		throw new RangeError('Surface scales must be positive');
	return { seed, moduleScale, reliefScale, level };
}

/** Builds one family on one patch. The relief level coarsens the module by the configured step
 * until the patch fits its triangle budget (`patch.budget`, else the configured density times
 * its area) and falls back to the flat level after the step limit. The same family, patch and
 * options always yield the same arrays. Throws RangeError for an invalid patch or family. */
// Exact arithmetic: neutral defaults.
export function buildSurface(
	family: Family,
	patch: Patch,
	options: SurfaceOptions = {}
): SurfaceMesh {
	const frame = readFrame(patch);
	const { layout, params } = readFamily(family);
	const { seed, moduleScale, reliefScale, level } = readOptions(options);
	const budget = patch.budget ?? patchTrianglesPerSquareM * readPatchArea(frame);
	const unitsAt = (scale: number) => {
		const scaled = scaleParams(params, scale, reliefScale);
		return { scaled, units: layouts[layout](scaled, patch.size, seeded(family, seed)) };
	};
	let scale = moduleScale;
	for (let step = 0; level === 'relief' && step <= coarsenStepLimit; step++) {
		const mesh = buildRelief(family, frame, unitsAt(scale).units, scale, options.light);
		if (mesh.triangles <= budget) return mesh;
		scale *= coarsenStepRatio;
	}
	const { scaled, units } = unitsAt(scale);
	return buildFlat(family, frame, units, scaled, level === 'relief' ? 'flat' : level, scale);
}
