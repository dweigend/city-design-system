import type { Vec2, Vec3 } from '../../core/geometry';
import { move, PlaceableObject } from '../../core/object';
import type { HouseFace } from '../../domain/house-court';
import { defaults } from '../../../config/house-projection';
import { readSurfaceLevel, type DisplayLevel } from '../focus';
import {
	createClad,
	fitModuleScale,
	lowerLevel,
	printsMarks,
	readFamily,
	readLevelDetail,
	type CladObject,
	type Cladding,
	type Patch,
	type SurfaceLevel,
	type SurfaceLevelAlias
} from '../material';
import {
	paintClad,
	readModelSurface,
	type Drawable,
	type ModelMaterial,
	type Surface,
	type SurfaceAssignment
} from '../surface';
import { houseLevels } from './levels';
import { planHouseMaterials, type HouseMaterials, type MaterialRole } from './materials';

const { cladOffsetM, cladSkinM } = defaults;

/** Where a house stands on the stage: a translation after a rotation in radians about Z, as
 * `move` applies it. */
export type HousePlacement = Readonly<{ translation: Vec3; radians: number }>;

/** Options of a clad house drawing: its cladding triangle budget, a placement, a seed for the
 * material draw and an optional surface level below the display level's own (aliases `relief`
 * and `flat` are near and far). `light` is accepted and unused: model surfaces cast no shade
 * onto themselves (MAT-2). */
export type CladHouseOptions = Readonly<{
	budget: number;
	light?: Vec3;
	placement?: HousePlacement;
	seed?: number;
	level?: SurfaceLevel | SurfaceLevelAlias;
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

type Plan = ReturnType<typeof planHouseMaterials>;
type Skin = 'deep' | 'thin';

/** The material a face wears: its body's, or the flat roof tone on a roof face unless the body's
 * pattern wraps over it (MAT-9, MAT-13). */
function materialOf(materials: HouseMaterials, plan: Plan, face: HouseFace) {
	const role = materials.slots[face.slot];
	const body = role ? plan[role] : undefined;
	if (!body) return undefined;
	const wraps = readFamily(body.family).pattern === 'stripe';
	return face.place === 'roof' && role !== 'roof' && !wraps ? plan.roof : body;
}

/** Which faces need a cladding at a level: a printed pattern the level shows, a roof tone, or a
 * deep skin that recesses the openings of a body that has any. Plain walls stay the body's own
 * paint. */
function skinOf(
	material: ModelMaterial,
	face: HouseFace,
	level: SurfaceLevel,
	recessed: boolean
): Skin | undefined {
	if (face.place === 'wall' && readLevelDetail(level).openings && recessed) return 'deep';
	if (printsMarks(material.family, level) || face.place === 'roof') return 'thin';
	return undefined;
}

// Exact arithmetic: a deep skin reaches back to the body face and past both ends of the wall.
function patchOf(face: HouseFace, skin: Skin, budget: number): Patch {
	const [ox, oy, oz] = face.origin;
	const [nx, ny, nz] = face.normal;
	const [ax, ay, az] = face.across;
	const lift = skin === 'deep' ? cladSkinM : cladOffsetM;
	const extend = skin === 'deep' ? cladSkinM : 0;
	return {
		origin: [
			ox + nx * lift - ax * extend,
			oy + ny * lift - ay * extend,
			oz + nz * lift - az * extend
		],
		across: face.across,
		normal: face.normal,
		size: [face.size[0] + 2 * extend, face.size[1]],
		thickness: skin === 'deep' ? cladSkinM : 0,
		backed: false,
		...(face.outline ? { outline: face.outline } : {}),
		openings: face.openings.map(([u0, v0, u1, v1]) => [u0 + extend, v0, u1 + extend, v1] as const),
		budget
	};
}

/** Claddings of the faces that need one at the level (see `projectCladHouse`), each in its
 * body's material from the house's material draw, faces of one body sharing one pattern box, given
 * its share of the budget by area. `house` and `seed` key the draw. */
export function houseCladdings(
	faces: readonly HouseFace[],
	materials: HouseMaterials,
	budget: number,
	level: SurfaceLevel | SurfaceLevelAlias = 'near',
	house = '',
	seed = 0
): Cladding[] {
	const drawn = lowerLevel(level, undefined);
	const plan = planHouseMaterials(materials, house, seed);
	const recessed = new Set(faces.filter(({ openings }) => openings.length).map(({ body }) => body));
	const clad = faces.flatMap((face) => {
		const material = materialOf(materials, plan, face);
		const skin = material && skinOf(material, face, drawn, recessed.has(face.body));
		const area = faceAreaM2(face);
		return material && skin && area > 0 ? [{ face, material, skin, area }] : [];
	});
	const total = clad.reduce((sum, { area }) => sum + area, 0);
	return clad.map(({ face, material, skin, area }) => {
		const patch = patchOf(face, skin, Math.floor((budget * area) / total));
		return {
			role: face.slot,
			family: material.family,
			...(material.tone ? { tone: material.tone } : {}),
			body: face.body,
			patch,
			moduleScale: fitModuleScale(material.family, patch)
		};
	});
}

const hiddenAt = (level: SurfaceLevel) => {
	const { openings, accents } = readLevelDetail(level);
	return new Set([...(openings ? [] : ['opening', 'collar']), ...(accents ? [] : ['accent'])]);
};

function withoutHidden(object: PlaceableObject, level: SurfaceLevel) {
	const hidden = hiddenAt(level);
	if (!object.parts.some(({ slot }) => hidden.has(slot))) return object;
	return PlaceableObject.create({
		...object,
		parts: object.parts.filter(({ slot }) => !hidden.has(slot))
	});
}

type Built = Readonly<{ clad: CladObject; plan: Plan; level: SurfaceLevel }>;
const built = new WeakMap<PlaceableObject, WeakMap<object, WeakMap<object, Map<string, Built>>>>();

/** One house built at one level, cached per object, faces, materials and options, so a display
 * or focus change rebuilds nothing that exists. */
function buildHouse(
	object: PlaceableObject,
	faces: readonly HouseFace[],
	materials: HouseMaterials,
	level: SurfaceLevel,
	options: CladHouseOptions
): Built {
	const byFaces = built.get(object) ?? new WeakMap();
	built.set(object, byFaces);
	const byMaterials = byFaces.get(faces) ?? new WeakMap();
	byFaces.set(faces, byMaterials);
	const cache = byMaterials.get(materials) ?? new Map<string, Built>();
	byMaterials.set(materials, cache);
	const key = JSON.stringify([level, options.budget, options.seed ?? 0, options.placement ?? null]);
	const found = cache.get(key);
	if (found) return found;
	const placement = options.placement;
	const shown = withoutHidden(object, level);
	const placed = placement ? move(shown, placement.translation, placement.radians) : shown;
	const moved = placement ? faces.map((face) => place(face, placement)) : faces;
	const seed = options.seed ?? 0;
	const claddings = houseCladdings(moved, materials, options.budget, level, object.id, seed);
	const result = {
		clad: createClad(placed, claddings, { level }),
		plan: planHouseMaterials(materials, object.id, seed),
		level
	};
	cache.set(key, result);
	return result;
}

/** The plain slots of the house: the level's role table, with each body slot that has a role in
 * the house's drawn material as one flat matte tone, grain where the level draws it. */
function plainSurfaces(
	object: PlaceableObject,
	materials: HouseMaterials,
	{ plan, level }: Built,
	table: SurfaceAssignment
): SurfaceAssignment {
	const { grain } = readLevelDetail(level);
	return Object.fromEntries(
		object.slots.map((slot): [string, Surface | undefined] => {
			const own = table[slot];
			const role: MaterialRole | undefined = materials.slots[slot];
			const material = role ? plan[role] : undefined;
			if (!own || !material) return [slot, own];
			return [slot, { ...readModelSurface(material, 'normal', grain), stroke: own.stroke }];
		})
	);
}

/** Draws a house object as a model (MAT-3) at one display level: the bodies in the house's drawn
 * materials as flat matte tones, roof tops in the flat roof tone, printed patterns wrapping their
 * body, and a skin that recesses the openings, painted through `paintClad`. The surface level
 * (the display's own; `options.level` may lower it) decides what is drawn: far draws plain bodies
 * and roof tones with only large graphic patterns, mid adds openings, patterns and the accent,
 * near adds grain and joints. Builds are cached per house, faces, materials and options.
 * Cladding drawables get IDs under the object's ID. Returns the drawables and the cladding
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
	const house = buildHouse(object, faces, materials, lowerLevel(own, options.level), options);
	const plain = plainSurfaces(object, materials, house, surfaces);
	const ownParts = new Set(object.parts.map(({ id }) => id));
	const drawables = paintClad(house.clad, 'normal', plain).map((drawable): Drawable => {
		const mine = ownParts.has(drawable.id);
		return {
			...drawable,
			id: mine ? drawable.id : `${object.id}/${drawable.id}`,
			...(mine && hatch ? { hatch } : {}),
			...(fillAlpha < 1 ? { fillAlpha, occlude: true } : {})
		};
	});
	return { drawables, triangles: house.clad.triangles };
}
