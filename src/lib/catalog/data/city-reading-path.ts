/** The City overview reuses one view from each of these chapters. */
export const cityReadingPath = {
	plan: {
		step: '01',
		title: 'City plan',
		status: 'Game',
		text: 'Terrain contours run beneath the square and its lots. The 2051 plan marks the new lot beside retained buildings.',
		href: '/raster#court-growth',
		link: 'Compare growth at the square'
	},
	grid: {
		step: '02',
		title: 'Height zones and spatial grid',
		status: 'Planned',
		text: 'Section A–A′ lifts the plan into a coarse envelope. Lot divisions sit inside it, with the square left open.',
		href: '/raster#spatial-grid',
		link: 'Read the spatial grid'
	},
	volume: {
		step: '03',
		title: 'House volumes and openings',
		status: 'Bible study',
		text: 'Occupied cells carry the deck; the open bay keeps a passage through the building. Proven separately in the City Game volume prototype; shared integration is planned (ST6, #36).',
		href: '/formen#volume-section',
		link: 'See forms and construction phases'
	},
	connection: {
		step: '04',
		title: 'Elevated connections',
		status: 'Bible study',
		text: 'Schematic section of an elevated deck meeting a gallery door. Façade bridges with portals exist in the City Game prototype; sandbox integration is planned (ST12, #37).',
		href: '/interface#connections',
		link: 'Trace building connections'
	}
} as const;

/** Open review questions and picture gaps carried forward from the contributing packages. */
export const cityReview = {
	decisions: [
		'Picture targets for sandbox details (D5)',
		'Scope of the next city study after the first prototype (D6)'
	],
	gaps: [
		{
			text: 'The section is too flat to show the buildable height above the houses because the envelope currently takes the maximum of existing heights rather than a zone height bound (ST10 / ST6).',
			href: '/raster#spatial-grid',
			label: 'Grid'
		},
		{
			text: 'The form study shows too few cut-out cells for the voids to define the house.',
			href: '/formen#volume-section',
			label: 'Forms'
		},
		{
			text: 'The connection strip shows one building; it still needs a city section with a visible source for each network line.',
			href: '/interface#connections',
			label: 'Connections'
		}
	]
} as const;
