import { defineSettings, settingValues } from '../setting';

/** Nominal section sizes and gravity-routing reporting tolerance. */
export const settings = defineSettings({
	secondaryWidthM: {
		value: 0.16,
		unit: 'm',
		meaning: 'Outside width of a light square member',
		principle: 'FORM-6'
	},
	primaryWidthM: {
		value: 0.48,
		unit: 'm',
		meaning: 'Outside width of a primary square member',
		principle: 'FORM-6'
	},
	secondaryAreaM2: {
		value: 0.0135,
		unit: 'm²',
		meaning: 'Nominal steel area of the light section',
		rationale: 'Ideal welded square steel box, 160 mm outside with 25 mm plates'
	},
	primaryAreaM2: {
		value: 0.057344,
		unit: 'm²',
		meaning: 'Nominal steel area of the primary section',
		rationale: 'Ideal welded square steel box, 480 mm outside with 32 mm plates'
	},
	nominalStressKPa: {
		value: 210000,
		unit: 'kPa',
		meaning: 'Reference axial stress used to normalize the force estimate',
		rationale: 'Nominal axial reference near 60% of an assumed 355 MPa steel yield stress'
	},
	frameMaximumSpanM: {
		value: 16,
		unit: 'm',
		meaning: 'Maximum distance between adjacent frame bearing lines',
		principle: 'FORM-6'
	},
	frameClearBayM: {
		value: 1.2,
		unit: 'm',
		meaning: 'Minimum clear width and length of a plug-in frame bay',
		principle: 'CITY-7'
	},
	frameCollarWidthM: {
		value: 0.72,
		unit: 'm',
		meaning: 'Outside width of a frame bearing flange and post collar',
		principle: 'FORM-5'
	},
	frameBearingClearanceM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Minimum pad distance from a supporting roof edge',
		principle: 'FORM-8'
	},
	frameMinimumBearingRiseM: {
		value: 0.32,
		unit: 'm',
		meaning: 'Shortest bearing stem between a seat and the frame soffit',
		principle: 'FORM-5'
	},
	frameMaximumBearingRiseM: {
		value: 12,
		unit: 'm',
		meaning: 'Maximum clear bearing stem rise over stock or terrain',
		principle: 'FORM-8'
	},
	supportedFrameDeckThicknessM: {
		value: 0.28,
		unit: 'm',
		meaning: 'Thickness of the floor carried by the spanning frame',
		principle: 'FORM-6'
	},
	frameCollarDepthM: {
		value: 0.14,
		unit: 'm',
		meaning: 'Depth of a visible frame joint flange',
		principle: 'FORM-5'
	},
	frameBayHeightM: {
		value: 4.2,
		unit: 'm',
		meaning: 'Clear elevation from deck to upper frame soffit',
		principle: 'CITY-7'
	},
	frameContactToleranceM: {
		value: 1e-7,
		unit: 'm',
		meaning: 'Roundoff allowance for plan clearances and bearing contacts',
		principle: 'FORM-5'
	},
	balanceToleranceRatio: {
		value: 1e-9,
		unit: 'ratio',
		meaning: 'Permitted relative vertical load balance error',
		rationale: 'Allows roundoff after accumulating and splitting joint loads'
	}
});

/** Values consumed by the structural graph. */
export const defaults = settingValues(settings);
