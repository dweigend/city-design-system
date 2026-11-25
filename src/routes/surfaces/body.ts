import { specimenSettings as m } from '../../config/surface-specimens';
import { scaled, sum, type Vec3 } from '../../lib/core/geometry';
import {
	createClad,
	fitModuleScale,
	hasPrintedMarks,
	readLevelDetail,
	readPatchArea,
	readSurfaceLevelName,
	type CladObject,
	type Cladding,
	type Family,
	type Patch,
	type Rect,
	type SurfaceOptions
} from '../../lib/domain/material';
import { axes } from './axes';
import { groundFamily } from './controls';

type Volume = Readonly<{
	origin: Vec3;
	size: readonly [width: number, depth: number, height: number];
	front: readonly Rect[];
	east?: readonly Rect[];
}>;

// Exact arithmetic: wind counterclockwise in plan so each patch faces out.
function walls({ origin: [x, y, z], size: [width, depth, height], front, east }: Volume): Patch[] {
	return [
		{
			origin: [x, y, z],
			across: axes.east,
			normal: axes.south,
			size: [width, height],
			thickness: m.bodyWallM,
			openings: front
		},
		{
			origin: [x + width, y, z],
			across: axes.north,
			normal: axes.east,
			size: [depth, height],
			thickness: m.bodyWallM,
			openings: east
		},
		{
			origin: [x + width, y + depth, z],
			across: axes.west,
			normal: axes.north,
			size: [width, height],
			thickness: m.bodyWallM
		},
		{
			origin: [x, y + depth, z],
			across: axes.south,
			normal: axes.west,
			size: [depth, height],
			thickness: m.bodyWallM
		}
	];
}

function glazing({ openings = [], origin, across, normal }: Patch): Cladding[] {
	return openings.map(([left, bottom, right, top]) => ({
		role: 'opening',
		family: 'acrylic',
		patch: {
			origin: sum(
				sum(origin, scaled(across, left)),
				sum(scaled(axes.up, bottom), scaled(normal, -m.bodyOpeningInsetM))
			),
			across,
			normal,
			size: [right - left, top - bottom],
			thickness: m.bodyGlazingM
		}
	}));
}

// Exact arithmetic: a plan margin extends both ends of each side.
function slab(
	{ origin: [x, y], size: [width, depth] }: Volume,
	top: number,
	margin: number,
	thickness: number
): Patch {
	return {
		origin: [x - margin, y - margin, top],
		across: axes.east,
		normal: axes.up,
		size: [width + 2 * margin, depth + 2 * margin],
		thickness
	};
}

function roof(patch: Patch): Cladding {
	return { role: 'roof', family: 'board', tone: 'roof', patch };
}

function shareBudget(claddings: readonly Cladding[]): Cladding[] {
	// Roofs and the ground are closed boxes. Reserve their exact triangle count first.
	const slabTriangles = /* Exact arithmetic: six sides with two triangles each. */ 12;
	const patterned = claddings.filter(({ role }) => role === 'wall' || role === 'opening');
	const totalArea = patterned.reduce((sum, { patch }) => sum + readPatchArea(patch), 0);
	const budget = m.bodyTriangleBudget - (claddings.length - patterned.length) * slabTriangles;
	return claddings.map((cladding) => ({
		...cladding,
		patch: {
			...cladding.patch,
			budget:
				cladding.role === 'wall' || cladding.role === 'opening'
					? Math.floor((budget * readPatchArea(cladding.patch)) / totalArea)
					: slabTriangles
		}
	}));
}

function fitWallScale(claddings: readonly Cladding[], family: Family, options: SurfaceOptions) {
	const requested = options.moduleScale ?? 1;
	const level = readSurfaceLevelName(options.level ?? 'near');
	if (!hasPrintedMarks(family, level, requested, options.recipe)) return requested;
	const { openings } = readLevelDetail(level);
	return Math.max(
		requested,
		...claddings
			.filter(({ role }) => role === 'wall')
			.map(({ patch }) =>
				fitModuleScale(
					family,
					{
						...patch,
						openings: openings ? patch.openings : undefined,
						budget: (patch.budget ?? 0) * m.bodyPatternBudgetShare
					},
					options
				)
			)
	);
}

/** Stepped library specimen in meters. The lower bar and cantilevered reading room share a
 * wall pattern frame and scale (MAT-9). Flat slabs cap the volumes and frame the cantilever. */
export function createSampleBody(family: Family, options: SurfaceOptions = {}): CladObject {
	const [width, depth, height] = m.bodyBarM;
	const [pavilionWidth, pavilionDepth, pavilionHeight] = m.bodyPavilionM;
	const [offsetX, offsetY] = m.bodyPavilionOffsetM;
	const [overhang, slabThickness] = m.bodySlabM;
	const [groundMargin, groundThickness] = m.bodyGroundM;
	// Exact arithmetic: center both plan rectangles, then apply the upper volume's offset.
	const bar: Volume = {
		origin: [-width / 2, -depth / 2, 0],
		size: m.bodyBarM,
		front: [m.bodyBarFrontLightM, m.bodyBarEntranceM]
	};
	const barRoof = height + slabThickness;
	const pavilionFloor = barRoof + slabThickness;
	const pavilion: Volume = {
		origin: [offsetX - pavilionWidth / 2, offsetY - pavilionDepth / 2, pavilionFloor],
		size: m.bodyPavilionM,
		front: [m.bodyPavilionFrontLightM],
		east: [m.bodyPavilionEndLightM]
	};
	const wallPatches = [...walls(bar), ...walls(pavilion)];
	const detail = readLevelDetail(readSurfaceLevelName(options.level ?? 'near'));
	const claddings = shareBudget([
		...wallPatches.map((patch) => ({ role: 'wall', family, body: 'library', patch })),
		...(detail.openings ? wallPatches.flatMap(glazing) : []),
		roof(slab(bar, barRoof, overhang, slabThickness)),
		roof(slab(pavilion, pavilionFloor, overhang, slabThickness)),
		roof(slab(pavilion, pavilionFloor + pavilionHeight + slabThickness, overhang, slabThickness)),
		{ role: 'ground', family: groundFamily, patch: slab(bar, 0, groundMargin, groundThickness) }
	]);
	const wallScale = fitWallScale(claddings, family, options) / (options.moduleScale ?? 1);
	return createClad(
		{ id: 'sample-body', footprint: { width, depth }, anchors: [] },
		claddings.map((cladding) =>
			cladding.role === 'wall' ? { ...cladding, moduleScale: wallScale } : cladding
		),
		options
	);
}
