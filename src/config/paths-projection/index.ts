import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	walkwayWidthM: {
		value: 3.2,
		unit: 'm',
		meaning: 'Width of the elevated walking ribbon',
		principle: 'CITY-5'
	},
	bridgeWidthM: {
		value: 5,
		unit: 'm',
		meaning: 'Width of the crossing near grade',
		principle: 'CITY-5'
	},
	deckThicknessM: {
		value: 0.55,
		unit: 'm',
		meaning: 'Thickness of pedestrian deck slabs',
		principle: 'CITY-5'
	},
	walkwayPierRadiusM: {
		value: 0.45,
		unit: 'm',
		meaning: 'Radius of a pedestrian bearing column',
		principle: 'CITY-5'
	},
	railPierRadiusM: {
		value: 0.8,
		unit: 'm',
		meaning: 'Radius of a guideway pier',
		rationale: 'Carry the rail and its transverse bearing beam'
	},
	pierSides: {
		value: 8,
		unit: 'sides',
		meaning: 'Facets per circular support',
		rationale: 'Read as round at quarter zoom'
	},
	railWidthM: {
		value: 5.2,
		unit: 'm',
		meaning: 'Width of the rail guideway',
		rationale: 'Two narrow tracks on a shared deck'
	},
	railDeckThicknessM: {
		value: 0.9,
		unit: 'm',
		meaning: 'Thickness of the rail deck and transverse cap',
		rationale: 'Separate the platform surface and bearing'
	},
	trackSpacingM: {
		value: 2.6,
		unit: 'm',
		meaning: 'Distance between the two drawn track axes',
		rationale: 'Read the guideway as rail'
	},
	platformLengthM: {
		value: 60,
		unit: 'm',
		meaning: 'Length of station platform',
		rationale: 'One short train'
	},
	platformWidthM: {
		value: 13,
		unit: 'm',
		meaning: 'Full station platform width',
		rationale: 'Room for docking on either side'
	},
	canopyHeightM: {
		value: 3.3,
		unit: 'm',
		meaning: 'Underside of the station shelter above the platform',
		rationale: 'Make the station identifiable in elevation'
	},
	stairWidthM: {
		value: 1.6,
		unit: 'm',
		meaning: 'Width of one flight in a switchback',
		rationale: 'Two-way pedestrian access'
	},
	stairRiseM: {
		value: 0.18,
		unit: 'm',
		meaning: 'Maximum stair riser height',
		rationale: 'Draw walkable treads'
	},
	groundOverlayLiftM: {
		value: 0.55,
		unit: 'm',
		meaning: 'Height of the plan trace above ground',
		rationale: 'Keep the overlay clear of terrain triangles'
	},
	lineLiftM: {
		value: 0.22,
		unit: 'm',
		meaning: 'Height of linework above deck surfaces',
		rationale: 'Keep accent strokes clear of the geometry'
	},
	maximumMiterRatio: {
		value: 2,
		unit: 'm/m',
		meaning: 'Maximum width multiplier at a mitered deck joint',
		rationale: 'Keep corners within the clearance allowance'
	},
	stationCanopyLengthShare: {
		value: 0.5,
		unit: 'ratio',
		meaning: 'Share of platform length covered by the shelter',
		rationale: 'Leave both ends of the platform open'
	},
	groundStrokePx: {
		value: 0.85,
		unit: 'px',
		meaning: 'Screen width of provisional lane traces',
		rationale: 'Keep the plan visible behind decks'
	},
	deckStrokePx: {
		value: 1.25,
		unit: 'px',
		meaning: 'Screen width of a walkway trace',
		rationale: 'Retain a readable route at town scale'
	},
	railStrokePx: {
		value: 1.8,
		unit: 'px',
		meaning: 'Screen width of the rail guideway trace',
		rationale: 'Make the alignment legible at valley scale'
	},
	trackStrokePx: {
		value: 0.7,
		unit: 'px',
		meaning: 'Screen width of track-axis linework',
		rationale: 'Show the two tracks at quarter scale'
	},
	routeStrokePx: {
		value: 3.4,
		unit: 'px',
		meaning: 'Screen width of the queried route',
		rationale: 'Separate route from the surrounding paths'
	},
	routeEndpointRadiusM: {
		value: 3.5,
		unit: 'm',
		meaning: 'Radius of the start and destination marks',
		rationale: 'Locate each end of the queried route'
	}
});

export const defaults = settingValues(settings);
