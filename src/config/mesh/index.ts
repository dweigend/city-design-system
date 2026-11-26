import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	tubeFrameToleranceRatio: {
		value: 1e-12,
		unit: 'ratio',
		meaning: 'Tolerance for a unit transverse, its orthogonality, and an opposed tangent bisector',
		rationale: 'Absorb unit-vector roundoff and reject reversals without a stable tangent'
	},
	maximumTubeRadialSegments: {
		value: 256,
		unit: 'segments',
		meaning: 'Maximum facet count around a tube profile',
		rationale: 'Bound geometry allocation for caller-supplied sweep resolution'
	},
	maximumTubeStations: {
		value: 8192,
		unit: 'stations',
		meaning: 'Maximum number of centerline samples in a swept tube',
		rationale: 'Bound geometry allocation as twist and ribs add stations'
	},
	maximumTubeRollStepRad: {
		value: Math.PI / 4,
		unit: 'rad',
		meaning: 'Maximum applied roll between consecutive tube sections',
		rationale: 'Keep a half-turn endpoint correction from folding a short sweep'
	},
	opposedDirectionTolerance: {
		value: 1e-8,
		unit: 'ratio',
		meaning: 'Minimum quaternion scalar before applying the opposite-axis rotation',
		rationale:
			'Preserve the positive-Z segment rotation used by the renderer at nearly opposite directions'
	},
	pierSides: {
		value: 8,
		unit: 'sides',
		meaning: 'Facets per circular support',
		rationale: 'Read as round at quarter zoom'
	},
	maximumMiterRatio: {
		value: 2,
		unit: 'm/m',
		meaning: 'Maximum width multiplier at a mitered deck joint',
		rationale: 'Keep corners within the clearance allowance'
	}
});

export const defaults = settingValues(settings);
