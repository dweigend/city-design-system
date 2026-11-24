import { specimenSettings as m } from '../../config/surface-specimens';
import { scaled, sum, type Vec3 } from '../../lib/core/geometry';
import { axes } from './axes';
import {
	createClad,
	readPatchArea,
	type CladObject,
	type Cladding,
	type Family,
	type Patch,
	type Rect,
	type SurfaceOptions
} from '../../lib/domain/material';
import { groundFamily } from './controls';

type Wall = Readonly<{ origin: Vec3; across: Vec3; normal: Vec3; length: number; gable: boolean }>;

// Exact arithmetic: four walls around the origin, gables on the short sides.
function walls(width: number, depth: number): Wall[] {
	const [x, y] = [width / 2, depth / 2];
	return [
		{ origin: [-x, -y, 0], across: axes.east, normal: axes.south, length: width, gable: false },
		{ origin: [x, -y, 0], across: axes.north, normal: axes.east, length: depth, gable: true },
		{ origin: [x, y, 0], across: axes.west, normal: axes.north, length: width, gable: false },
		{ origin: [-x, y, 0], across: axes.south, normal: axes.west, length: depth, gable: true }
	];
}

// Exact arithmetic: the door and a window on the front wall (0), a window on the east gable (1).
function openingsOf(index: number, length: number): Rect[] {
	const [doorWidth, doorHeight, doorOffset] = m.bodyDoorM;
	const [windowWidth, windowHeight, windowOffset, sill] = m.bodyWindowM;
	if (index === 0)
		return [
			[doorOffset, 0, doorOffset + doorWidth, doorHeight],
			[windowOffset, sill, windowOffset + windowWidth, sill + windowHeight]
		];
	if (index === 1)
		return [[(length - windowWidth) / 2, sill, (length + windowWidth) / 2, sill + windowHeight]];
	return [];
}

// Exact arithmetic: two slopes meet at the ridge over the middle of the depth.
function roofSlopes(width: number, depth: number, eaves: number, ridge: number): Patch[] {
	const run = depth / 2;
	const rise = ridge - eaves;
	const slope = Math.hypot(run, rise);
	const overhang = m.bodyEaveM;
	const size = [width + 2 * overhang, slope + overhang] as const;
	const front: Vec3 = [0, run / slope, rise / slope];
	const back: Vec3 = [0, -run / slope, rise / slope];
	const lift = m.bodyRoofLiftM;
	return [
		{
			origin: sum(
				sum([-width / 2 - overhang, -run, eaves], scaled(front, -overhang)),
				scaled([0, -front[2], front[1]], lift)
			),
			across: axes.east,
			normal: [0, -front[2], front[1]],
			size,
			thickness: m.bodyWallM
		},
		{
			origin: sum(
				sum([width / 2 + overhang, run, eaves], scaled(back, -overhang)),
				scaled([0, back[2], -back[1]], lift)
			),
			across: axes.west,
			normal: [0, back[2], -back[1]],
			size,
			thickness: m.bodyWallM
		}
	];
}

/** Glazing patches set into each opening, facing out with their wall. */
function glazing(wall: Wall, openings: readonly Rect[]): Patch[] {
	const upAxis = axes.up;
	return openings.map(([u0, v0, u1, v1]) => ({
		origin: sum(
			sum(wall.origin, scaled(wall.across, u0)),
			sum(scaled(upAxis, v0), scaled(wall.normal, -m.bodyOpeningInsetM))
		),
		across: wall.across,
		normal: wall.normal,
		size: [u1 - u0, v1 - v0],
		thickness: m.bodyGlazingM
	}));
}

/** A model house with a gable roof, a door and two windows, standing on a ground slab: walls in
 * the given family as one body, so a pattern wraps all four walls, the roof in the flat roof tone,
 * the ground in `ground`, the windows in lit acrylic (MAT-14). The triangle budget is shared among
 * the patches by area. Centred on the origin with the ground face at zero. */
export function createSampleBody(
	family: Family,
	options: SurfaceOptions = {},
	ground: Family = groundFamily
): CladObject {
	const [width, depth, eaves, ridge] = m.bodySizeM;
	const claddings = wallCladdings(family, m.bodySizeM);
	for (const patch of roofSlopes(width, depth, eaves, ridge))
		claddings.push({ role: 'roof', family: 'board', tone: 'roof', body: 'roof', patch });
	claddings.push(groundCladding(ground));
	return createClad(
		{ id: 'sample-body', footprint: { width, depth }, anchors: [] },
		shareBudget(claddings, m.bodyTriangleBudget),
		options
	);
}

// Exact arithmetic: a gable outline starts at the patch origin and peaks at mid-length.
function wallCladdings(
	family: Family,
	[width, depth, eaves, ridge]: readonly number[]
): Cladding[] {
	const claddings: Cladding[] = [];
	for (const [index, wall] of walls(width, depth).entries()) {
		const openings = openingsOf(index, wall.length);
		const outline = wall.gable
			? ([
					[0, 0],
					[wall.length, 0],
					[wall.length, eaves],
					[wall.length / 2, ridge],
					[0, eaves]
				] as const)
			: undefined;
		claddings.push({
			role: 'wall',
			family,
			body: 'house',
			patch: {
				origin: wall.origin,
				across: wall.across,
				normal: wall.normal,
				size: [wall.length, wall.gable ? ridge : eaves],
				thickness: m.bodyWallM,
				outline,
				openings
			}
		});
		for (const patch of glazing(wall, openings))
			claddings.push({ role: 'opening', family: 'acrylic', patch });
	}
	return claddings;
}

// Exact arithmetic: the ground face lies at zero around the centred body.
function groundCladding(ground: Family): Cladding {
	const [width, depth] = m.bodySizeM;
	const [margin, slab] = m.bodyGroundM;
	const groundOrigin: Vec3 = [-width / 2 - margin, -depth / 2 - margin, 0];
	return {
		role: 'ground',
		family: ground,
		patch: {
			origin: groundOrigin,
			across: axes.east,
			normal: axes.up,
			size: [width + 2 * margin, depth + 2 * margin],
			thickness: slab,
			openings: [[margin, margin, margin + width, margin + depth]]
		}
	};
}

function shareBudget(claddings: readonly Cladding[], budget: number): Cladding[] {
	const total = claddings.reduce((sum, { patch }) => sum + readPatchArea(patch), 0);
	return claddings.map((cladding) => ({
		...cladding,
		patch: {
			...cladding.patch,
			budget: Math.floor((budget * readPatchArea(cladding.patch)) / total)
		}
	}));
}
