import { defineParams, numberParam } from '../../logic/params';

/** Sandbox-specific materials. Drafting widths and tones belong to the bible's Leitstil. */
export const STRUCTURE_PARAMS = defineParams({
	minContourPx: numberParam('Minimum projected contour width', 'px', 6, [0, 16, 0.5]),
	// Glazed components are outside the opaque envelope role.
	glassOpacity: numberParam('Glass opacity', 'ratio', 0.34, [0, 1, 0.01])
});

/** Opening view scale and elevation on phones. */
export const OPENING_VIEW_PARAMS = defineParams({
	mobileCellWidthPx: numberParam('Mobile opening cell width', 'px', 15, [10, 55, 1]),
	mobileElevationDeg: numberParam('Mobile opening elevation', 'deg', 26, [8, 26, 1])
});

export type MinimumInk = 'primary' | 'all';
export const defaultMinimumInk: MinimumInk = 'all';

/** Terrain grid, cursor lens, alley ink and contour controls in cell units and ratios. */
export const TERRAIN_VIEW_PARAMS = defineParams({
	emptyInk: numberParam('Open alley impression ink', 'ratio', 0.02, [0, 1, 0.01]),
	embossInk: numberParam('Occupied alley impression ink', 'ratio', 0.04, [0, 1, 0.01]),
	promenadeWash: numberParam('Promenade wash', 'ratio', 0.15, [0, 1, 0.01]),
	embossWidth: numberParam('Alley impression width', 'ratio', 0.24, [0.05, 1, 0.01]),
	cityRadiusCells: numberParam('City radius cells', 'cells', 4, [1, 16, 1], 'integer'),
	treadsPerCell: numberParam('Treads per cell', 'steps', 4, [1, 10, 1], 'integer'),
	cellInk: numberParam('Cell ink', 'ratio', 0.16, [0, 1, 0.01]),
	nearStart: numberParam('Near start', 'cells/px', 0.05, [0.01, 0.1, 0.01]),
	nearEnd: numberParam('Near end', 'cells/px', 0.12, [0.11, 0.5, 0.01]),
	footbridgeTone: numberParam('Bridge tone', 'ratio', 0.25, [0, 1, 0.01]),
	minor: numberParam('Minor contour interval', 'm', 0.5, [0.25, 2, 0.25]),
	major: numberParam('Major contour interval', 'm', 5, [2, 10, 1]),
	ravineTone: numberParam('Ravine wash', 'ratio', 0.1, [0, 1, 0.01]),
	hatchSpacing: numberParam('Ravine hatch spacing', 'm', 4, [1, 10, 1]),
	paperWash: numberParam('Paper wash', 'ratio', 0.045, [0, 0.25, 0.005]),
	contourMinor: numberParam('Minor contour ink', 'ratio', 0.2, [0, 1, 0.01]),
	contourMajor: numberParam('Major contour ink', 'ratio', 0.44, [0, 1, 0.01]),
	parcel: numberParam('Parcel grid ink', 'ratio', 0.16, [0, 1, 0.01]),
	outline: numberParam('Land-cover outline ink', 'ratio', 0.55, [0, 1, 0.01]),
	parcelCells: numberParam('Measure chain interval', 'cells', 10, [1, 100, 1], 'integer'),
	lensCells: numberParam('Grid lens radius', 'cells', 11, [1, 100, 0.5]),
	planContourGain: numberParam('Plan contour gain', 'ratio', 0.9, [0, 1, 0.01])
});
