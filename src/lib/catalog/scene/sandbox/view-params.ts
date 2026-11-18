import { defineParams, numberParam } from '../../logic/params';

export const STRUCTURE_PARAMS = defineParams({
	creasePx: numberParam('Crease width', 'px', 0.8, [0.1, 8, 0.1]),
	outlinePx: numberParam('Outline width', 'px', 1, [0.1, 8, 0.1]),
	outlineMaxMeters: numberParam('Maximum outline width', 'm', 0.09, [0, 1, 0.01]),
	creaseFullAt: numberParam('Crease fade threshold', 'px/m', 7, [0.1, 100, 0.5]),
	creaseFloor: numberParam('Minimum crease opacity', 'ratio', 0.22, [0, 1, 0.01]),
	glassOpacity: numberParam('Glass opacity', 'ratio', 0.34, [0, 1, 0.01])
});

export const TERRAIN_VIEW_PARAMS = defineParams({
	parcelCells: numberParam('Measure chain interval', 'cells', 10, [1, 100, 1], 'integer'),
	lensCells: numberParam('Grid lens radius', 'cells', 11, [1, 100, 0.5]),
	streetTint: numberParam('Street tint', 'ratio', 0.3, [0, 1, 0.01]),
	planContourGain: numberParam('Plan contour gain', 'ratio', 0.9, [0, 1, 0.01])
});
