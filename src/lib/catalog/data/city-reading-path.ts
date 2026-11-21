/** The City overview reuses one view from each of these chapters. */
export const cityReadingPath = {
	plan: {
		title: 'City plan',
		status: 'Game',
		text: 'Terrain contours run beneath the court and its lots. The 2051 plan marks the new lot beside retained buildings.',
		href: '/raster#court-growth',
		link: 'Compare growth at the square'
	},
	grid: {
		title: 'Height zones and spatial grid',
		status: 'Planned',
		text: 'Section A–A′ lifts the plan into a coarse envelope. Lot and storey divisions sit inside it, with the square left open.',
		href: '/raster#spatial-grid',
		link: 'Read the spatial grid'
	},
	volume: {
		title: 'House volumes and openings',
		status: 'Lab',
		text: 'Occupied cells carry the deck. The open bay underneath keeps a passage through the building.',
		href: '/formen#volume-section',
		link: 'See forms and construction phases'
	},
	connection: {
		title: 'Elevated connections',
		status: 'Game',
		text: 'Follow an elevated deck to a gallery door. In the lab’s A–E span, geodesic domes become a chain of spherical rooms between two faces.',
		href: '/interface#connections',
		link: 'Trace building connections'
	}
} as const;

/** Open review questions and picture gaps carried forward from the contributing packages. */
export const cityReview = {
	decisions: [
		'First shared city-volume acceptance image (D1)',
		'Picture targets for sandbox details (D5)',
		'Scope of the next city study after the first prototype (D6)'
	],
	gaps: [
		{
			text: 'The section is too flat to show the buildable height above the houses (ST10 / ST6).',
			href: '/raster#spatial-grid',
			label: 'Grid'
		},
		{
			text: 'The form study shows too few cut-out cells for the voids to define the house.',
			href: '/formen#volume-section',
			label: 'Forms'
		},
		{
			text: 'The DB7 review saw one house. The strip still needs a city section with a visible source for each network line.',
			href: '/interface#connections',
			label: 'Connections'
		}
	]
} as const;
