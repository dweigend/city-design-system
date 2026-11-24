import { materialSettings } from '../../../config/material';
import { defineParams } from '../../core/params';
import { bounds, size } from '../../core/geometry';
import { createClad } from './clad';
import type { Family } from './families';
import { readFrame, type Patch } from './patch';
import type { SurfaceOptions } from './build';

/** Builds a clad plate and returns the placeable object with its scene paint groups.
 * The face anchor uses the caller's metric origin and normal. */
// Exact arithmetic: the backing runs from the front plane at zero to the negative thickness.
export function createSamplePlateObject(
	id: string,
	patch: Patch,
	family: Family,
	options: SurfaceOptions = {}
) {
	const frame = readFrame(patch);
	const corners = frame.outline.flatMap(([u, v]) => [
		frame.point(u, v, 0),
		frame.point(u, v, -patch.thickness)
	]);
	const extents = bounds(corners);
	if (!extents) throw new RangeError('Expected plate corners');
	const [width, depth] = size(extents);
	return createClad(
		{
			id,
			footprint: { width, depth },
			anchors: [{ name: 'face', position: patch.origin, normal: patch.normal }]
		},
		[{ role: id, family, patch }],
		options
	);
}

const { plateSideDefaultM, plateSideMinM, plateSideMaxM, plateSideStepM } = materialSettings;
const plateSide = {
	unit: 'm',
	default: plateSideDefaultM,
	min: plateSideMinM,
	max: plateSideMaxM,
	step: plateSideStepM
};

/** Parameter schema for the two sides of a free plate. */
export const samplePlateParams = defineParams({
	width: { ...plateSide, label: 'Width' },
	depth: { ...plateSide, label: 'Depth' }
});

/** Backing thickness for a free plate in meters. */
export const samplePlateBackingM = materialSettings.plateBackingM;
