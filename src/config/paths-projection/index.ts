import { defineSettings, settingValues } from '../setting';

export const settings = defineSettings({
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
