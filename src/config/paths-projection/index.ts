import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
	projectedTubeRadialSegments: {
		value: 24,
		unit: 'segments',
		meaning: 'Facets around the glazing, pipe and sleeves',
		rationale: 'Keep the curved profile readable at close range'
	},
	walkableTubeRadiusM: {
		value: 1.7,
		unit: 'm',
		meaning: 'Radius of the open pedestrian enclosure',
		principle: 'CITY-5'
	},
	walkableTubeDeckDropM: {
		value: 0.9,
		unit: 'm',
		meaning: 'Deck top below the enclosure axis',
		rationale: 'Keep headroom over a floor inside the circular section'
	},
	walkableTubeDeckWidthM: {
		value: 2.4,
		unit: 'm',
		meaning: 'Clear width of the floor between the glazing walls',
		principle: 'CITY-5'
	},
	walkableTubeDeckThicknessM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Thickness of the floor in the elevated enclosure',
		principle: 'CITY-5'
	},
	walkableTubeRibSpacingM: {
		value: 3,
		unit: 'm',
		meaning: 'Distance between structural ribs measured along the enclosure centerline',
		rationale: 'Repeat ribs at architectural bay spacing independently of curve sampling'
	},
	walkableTubeRibWidthM: {
		value: 0.14,
		unit: 'm',
		meaning: 'Axial width of pedestrian enclosure ribs and collars',
		principle: 'FORM-5'
	},
	servicePipeRadiusM: {
		value: 0.18,
		unit: 'm',
		meaning: 'Outside radius of a building service conduit',
		principle: 'COLOR-8'
	},
	servicePipeCollarWidthM: {
		value: 0.12,
		unit: 'm',
		meaning: 'Axial width of a building service fitting',
		principle: 'FORM-5'
	},
	projectedTubeCollarDepthRatio: {
		value: 0.07,
		unit: 'ratio',
		meaning: 'Radial overlap and projection of a sleeve, each as a share of tube radius',
		principle: 'FORM-5',
		bounds: { exclusiveMin: 0, exclusiveMax: 1 }
	},
	bridgeWidthM: {
		value: 5,
		unit: 'm',
		meaning: 'Width of the crossing near grade',
		principle: 'CITY-5'
	},
	railWidthM: {
		value: 5.2,
		unit: 'm',
		meaning: 'Width of the rail guideway',
		rationale: 'Two narrow tracks on a shared deck'
	},
	trackSpacingM: {
		value: 2.6,
		unit: 'm',
		meaning: 'Distance between the two drawn track axes',
		rationale: 'Read the guideway as rail'
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
	routeHiddenStrokeShare: {
		value: 1,
		unit: 'ratio',
		meaning: 'Opacity retained where the highlighted route runs under another deck',
		rationale: 'Keep the selected route continuous through level crossings',
		bounds: { min: 0, max: 1 }
	},
	routeEndpointRadiusM: {
		value: 3.5,
		unit: 'm',
		meaning: 'Radius of the start and destination marks',
		rationale: 'Locate each end of the queried route'
	}
});

export const defaults = settingValues(settings);
