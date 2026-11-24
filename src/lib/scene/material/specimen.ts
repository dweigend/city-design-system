import { materialSettings } from '../../../config/material';
import { convexHull, scaled, sum, type Vec2, type Vec3 } from '../../core/geometry';
import { PlaceableObject, type Part } from '../../core/object';
import { buildSurface, type SurfaceLevel, type SurfaceMesh, type SurfaceOptions } from './build';
import { readFamily, type Family } from './families';
import type { Patch, Rect } from './patch';

const m = materialSettings;

/** One family laid on one patch under a role name, such as wall or plate-2, with an optional
 * level and a module scale that multiplies the shared one. */
export type Cladding = Readonly<{
	role: string;
	family: Family;
	patch: Patch;
	level?: SurfaceLevel;
	moduleScale?: number;
}>;

/** An object whose slots are `role/slot` pairs, plus plain parts in slot `stand`. Materials and
 * drawn levels are keyed by role; lines are the pencil joint lines of a role. */
export type CladObject = Readonly<{
	object: PlaceableObject;
	materials: Readonly<Record<string, Family>>;
	levels: Readonly<Record<string, SurfaceLevel>>;
	lines: Readonly<Record<string, readonly number[]>>;
	surfaces: readonly SurfaceMesh[];
	triangles: number;
}>;

type Merged = { positions: number[]; indices: number[] };

/** Builds every cladding, merges meshes of the same role and slot into one part, and wraps
 * the result in the object contract. */
export function createClad(
	id: string,
	claddings: readonly Cladding[],
	options: SurfaceOptions,
	plain: readonly Part[] = []
): CladObject {
	const merged = new Map<string, Merged>();
	const materials: Record<string, Family> = {};
	const levels: Record<string, SurfaceLevel> = {};
	const lines: Record<string, number[]> = {};
	const surfaces: SurfaceMesh[] = [];
	for (const { role, family, patch, level, moduleScale = 1 } of claddings) {
		const surface = buildSurface(family, patch, {
			...options,
			level: level ?? options.level,
			moduleScale: (options.moduleScale ?? 1) * moduleScale
		});
		surfaces.push(surface);
		materials[role] = family;
		levels[role] = surface.level;
		(lines[role] ??= []).push(...surface.lines);
		for (const [slot, { positions, indices }] of surface.meshes) {
			const target = merged.get(`${role}/${slot}`) ?? { positions: [], indices: [] };
			merged.set(`${role}/${slot}`, target);
			const offset = target.positions.length / 3;
			for (const value of positions) target.positions.push(value);
			for (const index of indices) target.indices.push(index + offset);
		}
	}
	const parts: Part[] = [...merged].map(([slot, shape]) => ({ id: slot, slot, shape: { kind: 'mesh', ...shape } }));
	const object = PlaceableObject.create({
		id,
		slots: [...merged.keys(), ...(plain.length ? ['stand'] : [])],
		parts: [...parts, ...plain],
		footprint: { width: 0, depth: 0 },
		anchors: []
	});
	const triangles = surfaces.reduce((total, { triangles }) => total + triangles, 0);
	return { object, materials, levels, lines, surfaces, triangles };
}

const east: Vec3 = [1, 0, 0];
const up: Vec3 = [0, 0, 1];
const south: Vec3 = [0, -1, 0];

/** One sample plate per entry, upright for wall families and flat for ground families, on
 * stands in rows that rise toward the back, centred on the origin. */
export function createSampleBoard(entries: readonly Readonly<{ family: Family; level?: SurfaceLevel }>[], options: SurfaceOptions = {}): CladObject {
	const [width, height] = m.plateSizeM;
	const [gapAcross, gapBack] = m.plateGapM;
	const [standFront, standStep, standDepth] = m.plateStandM;
	const columns = Math.min(m.plateColumns, entries.length);
	const claddings: Cladding[] = [];
	const stands: Part[] = [];
	for (const [i, { family, level }] of entries.entries()) {
		const column = i % columns;
		const row = Math.floor(i / columns);
		const x = (column - (columns - 1) / 2) * (width + gapAcross) - width / 2;
		const y = row * gapBack;
		const z = standFront + row * standStep;
		const flat = readFamily(family).ground;
		const patch: Patch = flat
			? { origin: [x, y, z + m.plateThicknessM], across: east, normal: up, size: [width, height], thickness: m.plateThicknessM, budget: m.plateTriangleBudget }
			: { origin: [x, y, z], across: east, normal: south, size: [width, height], thickness: m.plateThicknessM, budget: m.plateTriangleBudget };
		claddings.push({ role: `plate-${i}`, family, patch, level });
		const depth = flat ? height : standDepth;
		stands.push({ id: `stand-${i}`, slot: 'stand', shape: { kind: 'box', center: [x + width / 2, y + depth / 2, z / 2], size: [width, depth, z], rotation: 0 } });
	}
	return createClad('sample-board', claddings, options, stands);
}

type Wall = Readonly<{ origin: Vec3; across: Vec3; normal: Vec3; length: number; gable: boolean }>;

function walls(width: number, depth: number): Wall[] {
	const [x, y] = [width / 2, depth / 2];
	return [
		{ origin: [-x, -y, 0], across: east, normal: south, length: width, gable: false },
		{ origin: [x, -y, 0], across: [0, 1, 0], normal: east, length: depth, gable: true },
		{ origin: [x, y, 0], across: [-1, 0, 0], normal: [0, 1, 0], length: width, gable: false },
		{ origin: [-x, y, 0], across: [0, -1, 0], normal: [-1, 0, 0], length: depth, gable: true }
	];
}

function openingsOf(index: number, length: number): Rect[] {
	const [doorWidth, doorHeight, doorOffset] = m.bodyDoorM;
	const [windowWidth, windowHeight, windowOffset, sill] = m.bodyWindowM;
	if (index === 0)
		return [
			[doorOffset, 0, doorOffset + doorWidth, doorHeight],
			[windowOffset, sill, windowOffset + windowWidth, sill + windowHeight]
		];
	if (index === 1) return [[(length - windowWidth) / 2, sill, (length + windowWidth) / 2, sill + windowHeight]];
	return [];
}

function roofSlopes(width: number, depth: number, eaves: number, ridge: number): Patch[] {
	const run = depth / 2;
	const rise = ridge - eaves;
	const slope = Math.hypot(run, rise);
	const overhang = m.bodyEaveM;
	const size = [width + 2 * overhang, slope + overhang] as const;
	const front: Vec3 = [0, run / slope, rise / slope];
	const back: Vec3 = [0, -run / slope, rise / slope];
	return [
		{ origin: sum([-width / 2 - overhang, -run, eaves], scaled(front, -overhang)), across: east, normal: [0, -front[2], front[1]], size, thickness: m.bodyWallM },
		{ origin: sum([width / 2 + overhang, run, eaves], scaled(back, -overhang)), across: [-1, 0, 0], normal: [0, back[2], -back[1]], size, thickness: m.bodyWallM }
	];
}

/** Glazing patches set into each opening, facing out with their wall. */
function glazing(wall: Wall, openings: readonly Rect[]): Patch[] {
	const upAxis: Vec3 = [0, 0, 1];
	return openings.map(([u0, v0, u1, v1]) => ({
		origin: sum(sum(wall.origin, scaled(wall.across, u0)), sum(scaled(upAxis, v0), scaled(wall.normal, -m.bodyOpeningInsetM))),
		across: wall.across,
		normal: wall.normal,
		size: [u1 - u0, v1 - v0],
		thickness: m.bodyGlazingM
	}));
}

/** The ground shade of the body: the hull of its corners and ridge moved along the light onto
 * the ground, in the ground patch's meters. */
function bodyShadow(light: Vec3, origin: Vec3, [width, depth, eaves, ridge]: readonly number[]): Vec2[] {
	const [x, y] = [width / 2 + m.bodyEaveM, depth / 2];
	const corners: Vec3[] = [-1, 1].flatMap((sx) =>
		[-1, 1].flatMap((sy): Vec3[] => [
			[(sx * width) / 2, sy * y, 0],
			[sx * x, sy * y, eaves]
		])
	);
	corners.push([-x, 0, ridge], [x, 0, ridge]);
	const ground = corners.map(([px, py, pz]): Vec2 => {
		const reach = -pz / light[2];
		return [px + reach * light[0] - origin[0], py + reach * light[1] - origin[1]];
	});
	return [...convexHull(ground)];
}

/** A box house with a gable roof, a door and two windows, standing on a ground slab: walls in
 * the given family, roof in `roof`, ground in `ground`, glazing in glass. The triangle budget is
 * shared among the patches by area. Centred on the origin with the ground face at zero. */
export function createSampleBody(family: Family, options: SurfaceOptions = {}, roof: Family = 'metal', ground: Family = 'paving'): CladObject {
	const [width, depth, eaves, ridge] = m.bodySizeM;
	const [margin, slab] = m.bodyGroundM;
	const claddings: Cladding[] = [];
	for (const [index, wall] of walls(width, depth).entries()) {
		const openings = openingsOf(index, wall.length);
		const outline = wall.gable
			? ([[0, 0], [wall.length, 0], [wall.length, eaves], [wall.length / 2, ridge], [0, eaves]] as const)
			: undefined;
		claddings.push({ role: 'wall', family, patch: { origin: wall.origin, across: wall.across, normal: wall.normal, size: [wall.length, wall.gable ? ridge : eaves], thickness: m.bodyWallM, outline, openings } });
		for (const patch of glazing(wall, openings)) claddings.push({ role: 'opening', family: 'glass', patch });
	}
	for (const patch of roofSlopes(width, depth, eaves, ridge)) claddings.push({ role: 'roof', family: roof, patch });
	const groundOrigin: Vec3 = [-width / 2 - margin, -depth / 2 - margin, 0];
	const shadows = options.light ? [bodyShadow(options.light, groundOrigin, m.bodySizeM)] : [];
	claddings.push({
		role: 'ground',
		family: ground,
		moduleScale: m.bodyGroundModuleScale,
		patch: { origin: groundOrigin, across: east, normal: up, size: [width + 2 * margin, depth + 2 * margin], thickness: slab, openings: [[margin, margin, margin + width, margin + depth]], shadows }
	});
	return createClad('sample-body', shareBudget(claddings, m.bodyTriangleBudget), options);
}

function area({ size, outline, openings = [] }: Patch) {
	const shape = outline ?? [[0, 0], [size[0], 0], size, [0, size[1]]];
	let twice = 0;
	for (const [i, [u0, v0]] of shape.entries()) {
		const [u1, v1] = shape[(i + 1) % shape.length];
		twice += u0 * v1 - u1 * v0;
	}
	return twice / 2 - openings.reduce((total, [u0, v0, u1, v1]) => total + (u1 - u0) * (v1 - v0), 0);
}

function shareBudget(claddings: readonly Cladding[], budget: number): Cladding[] {
	const total = claddings.reduce((sum, { patch }) => sum + area(patch), 0);
	return claddings.map((cladding) => ({ ...cladding, patch: { ...cladding.patch, budget: Math.floor((budget * area(cladding.patch)) / total) } }));
}
