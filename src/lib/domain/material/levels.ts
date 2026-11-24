import { surfaceLevelTable } from '../../../config/material';

/** Drawing detail of a surface by distance (MAT-5): near adds grain, joints and accents to mid,
 * mid adds openings and fine patterns to far, far is the plain body in its tone with only large
 * graphic patterns, pencil is the face with its joints as pencil lines. */
export type SurfaceLevel = keyof typeof surfaceLevelTable;
/** Older level names kept for callers: `relief` is near, `flat` is far. */
export type SurfaceLevelAlias = 'relief' | 'flat';
/** Surface levels from most to least detail. */
export const surfaceLevels = Object.freeze(Object.keys(surfaceLevelTable) as SurfaceLevel[]);

const aliases = Object.freeze({ relief: 'near', flat: 'far' } as const);

/** Resolves a level or an alias. Throws RangeError for an unknown name. */
export function readSurfaceLevelName(level: SurfaceLevel | SurfaceLevelAlias): SurfaceLevel {
	if (Object.hasOwn(aliases, level)) return aliases[level as SurfaceLevelAlias];
	if (!Object.hasOwn(surfaceLevelTable, level))
		throw new RangeError(`Unknown surface level "${String(level)}"`);
	return level as SurfaceLevel;
}

/** What a level draws: pattern marks, openings, joints, grain and accents. */
export function readLevelDetail(level: SurfaceLevel | SurfaceLevelAlias) {
	return surfaceLevelTable[readSurfaceLevelName(level)];
}

/** The less detailed of two levels, aliases resolved; pencil counts as least detailed. */
export function lowerLevel(
	a: SurfaceLevel | SurfaceLevelAlias,
	b: SurfaceLevel | SurfaceLevelAlias | undefined
): SurfaceLevel {
	const first = readSurfaceLevelName(a);
	if (!b) return first;
	const second = readSurfaceLevelName(b);
	return surfaceLevels.indexOf(second) > surfaceLevels.indexOf(first) ? second : first;
}
