import { defineParams, numberParam } from '../../logic/params';

/** Structure outline, crease and glass controls in pixels, meters and opacity ratios. */
export const STRUCTURE_PARAMS = defineParams({
	creasePx: numberParam('Crease width', 'px', 0.8, [0.1, 8, 0.1]),
	outlinePx: numberParam('Outline width', 'px', 1, [0.1, 8, 0.1]),
	outlineMaxMeters: numberParam('Maximum outline width', 'm', 0.09, [0, 1, 0.01]),
	creaseFullAt: numberParam('Crease fade threshold', 'px/m', 7, [0.1, 100, 0.5]),
	creaseFloor: numberParam('Minimum crease opacity', 'ratio', 0.22, [0, 1, 0.01]),
	glassOpacity: numberParam('Glass opacity', 'ratio', 0.34, [0, 1, 0.01])
});

/** Terrain grid, cursor lens, alley ink and contour controls in cell units and ratios. */
export const TERRAIN_VIEW_PARAMS = defineParams({
	emptyInk: numberParam('Empty ink', 'ratio', 0.08, [0, 1, 0.01]),
	cityInk: numberParam('City ink', 'ratio', 0.15, [0, 1, 0.01]),
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
	contourMinor: numberParam('contourMinor', 'ratio', 0.2, [0, 1, 0.01]),
	contourMajor: numberParam('contourMajor', 'ratio', 0.44, [0, 1, 0.01]),
	parcel: numberParam('parcel', 'ratio', 0.16, [0, 1, 0.01]),
	outline: numberParam('outline', 'ratio', 0.55, [0, 1, 0.01]),
	parcelCells: numberParam('Measure chain interval', 'cells', 10, [1, 100, 1], 'integer'),
	lensCells: numberParam('Grid lens radius', 'cells', 11, [1, 100, 0.5]),
	planContourGain: numberParam('Plan contour gain', 'ratio', 0.9, [0, 1, 0.01])
});
