import { surfaceLevelTable } from '../../../config/material';
import { createCatalog } from '../../core/catalog';

/** Drawing detail of a surface (MAT-5, MAT-15): plain is the default body in one tone, far adds
 * the roof tone and large graphic patterns, mid openings and rims, near patterns, grain, joints
 * and accents; pencil is the face with its joints as pencil lines. */
export type SurfaceLevel = keyof typeof surfaceLevelTable;
/** Older level names kept for callers: `relief` is near, `flat` is the plain default. */
export type SurfaceLevelAlias = 'relief' | 'flat';
const levels = createCatalog({
	rows: Object.entries(surfaceLevelTable).map(([id, detail]) => ({
		id: id as SurfaceLevel,
		detail
	})),
	missingError: (id) => new RangeError(`Unknown surface level "${String(id)}"`)
});

/** Surface levels from most to least detail. */
export const surfaceLevels = levels.ids;

function readLevel(level: SurfaceLevel | SurfaceLevelAlias) {
	if (level === 'relief') return levels.get('near');
	if (level === 'flat') return levels.get('plain');
	return levels.get(level);
}

/** Resolves a level or an alias. Throws RangeError for an unknown name. */
export function readSurfaceLevelName(level: SurfaceLevel | SurfaceLevelAlias): SurfaceLevel {
	return readLevel(level).id;
}

/** What a level draws: pattern marks, openings, joints, grain and accents. */
export function readLevelDetail(level: SurfaceLevel | SurfaceLevelAlias) {
	return readLevel(level).detail;
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
