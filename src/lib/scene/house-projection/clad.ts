import type { Vec2, Vec3 } from '../../core/geometry';
import { move, type PlaceableObject } from '../../core/object';
import type { HouseFace } from '../../domain/house-court';
import { defaults } from '../../../config/house-projection';
import { readSurfaceLevel, type DisplayLevel } from '../focus';
import {
	createClad,
	fitModuleScale,
	type Cladding,
	type Family,
	type Patch,
	type SurfaceLevel
} from '../material';
import { paintClad, type Drawable, type SurfaceAssignment } from '../surface';
import { houseLevels } from './levels';
import type { HouseMaterials } from './materials';

const { cladOffsetM, cladThicknessM } = defaults;

/** Where a house stands on the stage: a translation after a rotation in radians about Z, as
 * `move` applies it. */
export type HousePlacement = Readonly<{ translation: Vec3; radians: number }>;

/** Options of a clad house drawing: its cladding triangle budget, the light direction in stage
 * axes, a placement, a seed and an optional surface level below the display level's own. */
export type CladHouseOptions = Readonly<{
	budget: number;
	light?: Vec3;
	placement?: HousePlacement;
	seed?: number;
	level?: SurfaceLevel;
}>;

/** Plan area of a face in square meters, its outline (or rectangle) less its openings. */
// Exact arithmetic: the shoelace sum.
export function faceAreaM2({ size, outline, openings }: HouseFace): number {
	const ring: readonly Vec2[] = outline ?? [
		[0, 0],
		[size[0], 0],
		[size[0], size[1]],
		[0, size[1]]
	];
	const twice = ring.reduce((sum, [u0, v0], i) => {
		const [u1, v1] = ring[(i + 1) % ring.length];
		return sum + u0 * v1 - u1 * v0;
	}, 0);
	const holes = openings.reduce((sum, [u0, v0, u1, v1]) => sum + (u1 - u0) * (v1 - v0), 0);
	return Math.max(0, twice / 2 - holes);
}

function place(face: HouseFace, { translation, radians }: HousePlacement): HouseFace {
	const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
	const rotate = ([x, y, z]: Vec3): Vec3 => [x * cos - y * sin, x * sin + y * cos, z];
	const [x, y, z] = rotate(face.origin);
	return {
		...face,
		origin: [x + translation[0], y + translation[1], z + translation[2]],
		across: rotate(face.across),
		normal: rotate(face.normal)
	};
}

function familyOf(materials: HouseMaterials, face: HouseFace): Family | undefined {
	const table = face.place === 'wall' ? materials.wall : materials.roof;
	return Object.hasOwn(table, face.slot) ? table[face.slot] : undefined;
}

/** Claddings of the faces that have a family, each patch set off its face by the clad offset,
 * given its share of the budget by area. Relief and pencil also fit the surface modules. */
export function houseCladdings(
	faces: readonly HouseFace[],
	materials: HouseMaterials,
	budget: number,
	level: SurfaceLevel = 'relief'
): Cladding[] {
	const clad = faces.flatMap((face) => {
		const family = familyOf(materials, face);
		return family ? [{ face, family, area: faceAreaM2(face) }] : [];
	});
	const total = clad.reduce((sum, { area }) => sum + area, 0);
	return clad.flatMap(({ face, family, area }) => {
		if (!(area > 0)) return [];
		const [ox, oy, oz] = face.origin;
		const [nx, ny, nz] = face.normal;
		const patch: Patch = {
			origin: [ox + nx * cladOffsetM, oy + ny * cladOffsetM, oz + nz * cladOffsetM],
			across: face.across,
			normal: face.normal,
			size: face.size,
			thickness: cladThicknessM,
			...(face.outline ? { outline: face.outline } : {}),
			openings: face.openings,
			budget: Math.floor((budget * area) / total)
		};
		const cladding = { role: face.slot, family, patch };
		return [
			level === 'flat' ? cladding : { ...cladding, moduleScale: fitModuleScale(family, patch) }
		];
	});
}

/** Draws a house object wearing surface families on its planar faces at one display level: the
 * object's own slots from the level's role table, the claddings painted through `paintClad`. The
 * level's surface detail (relief, flat or pencil; `options.level` may lower it) and the triangle
 * budget decide how much relief is built. The object and faces are placed alike before cladding;
 * cladding drawables get IDs under the object's ID. Returns the drawables and the cladding
 * triangle count; `hidden` draws nothing. */
// Exact arithmetic: an empty drawing has no triangles.
export function projectCladHouse(
	object: PlaceableObject,
	faces: readonly HouseFace[],
	materials: HouseMaterials,
	display: DisplayLevel,
	options: CladHouseOptions
): Readonly<{ drawables: Drawable[]; triangles: number }> {
	const { surfaces, hatch, fillAlpha } = houseLevels[display];
	const own = readSurfaceLevel(display);
	if (!surfaces || !own) return { drawables: [], triangles: 0 };
	const placed = options.placement
		? move(object, options.placement.translation, options.placement.radians)
		: object;
	const placement = options.placement;
	const moved = placement ? faces.map((face) => place(face, placement)) : faces;
	const level = lower(own, options.level);
	const clad = createClad(placed, houseCladdings(moved, materials, options.budget, level), {
		...(options.light ? { light: options.light } : {}),
		...(options.seed === undefined ? {} : { seed: options.seed }),
		level
	});
	const table: SurfaceAssignment = surfaces;
	const plain = Object.fromEntries(object.slots.map((slot) => [slot, table[slot]]));
	const ownParts = new Set(object.parts.map(({ id }) => id));
	const drawables = paintClad(clad, 'normal', plain).map((drawable): Drawable => {
		const mine = ownParts.has(drawable.id);
		return {
			...drawable,
			id: mine ? drawable.id : `${object.id}/${drawable.id}`,
			...(mine && hatch ? { hatch } : {}),
			...(fillAlpha < 1 ? { fillAlpha, occlude: true } : {})
		};
	});
	return { drawables, triangles: clad.triangles };
}

const order = ['relief', 'flat', 'pencil'] as const;

/** The less detailed of two surface levels; pencil counts as least detailed. */
// Exact arithmetic: list order.
function lower(a: SurfaceLevel, b: SurfaceLevel | undefined): SurfaceLevel {
	return b && order.indexOf(b) > order.indexOf(a) ? b : a;
}
